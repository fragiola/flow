// @vitest-environment jsdom
// Auto-pan (the `autoPan` engine option): a node drag, a connection, a reconnection, a selection
// box or a resize whose pointer nears the root's edge pans the viewport every frame (the root
// window's frames, faked here), faster nearer the edge, never past the translate extent, and the
// gesture follows the still pointer: what is dragged stays under it.
import { afterEach, describe, expect, it } from "vitest";
import { connection } from "../../src/connection/connection";
import { drag } from "../../src/drag/drag";
import { autoPanOffset } from "../../src/engine/auto-pan";
import type { FlowEngineOptions } from "../../src/engine/create-flow-engine";
import type { Viewport } from "../../src/geometry/types";
import { toFlow } from "../../src/geometry/viewport-math";
import { reconnection } from "../../src/reconnection/reconnection";
import { resize } from "../../src/resize/resize";
import { selection } from "../../src/selection/selection";
import {
    flowOf,
    type HandleSpec,
    installFrames,
    key,
    mount,
    pointer,
    unmountAll,
} from "./harness";

afterEach(unmountAll);

const at = (clientX: number, clientY: number) => ({ clientX, clientY });
const SIZE = { width: 800, height: 600 };

describe("autoPanOffset", () => {
    it("pans towards the edge the pointer nears, faster nearer it", () => {
        expect(autoPanOffset({ x: 400, y: 300 }, SIZE, true)).toEqual({
            x: 0,
            y: 0,
        });
        // 30 px of margin, 10 px a frame at the edge: 15 px in is half
        expect(autoPanOffset({ x: 15, y: 300 }, SIZE, undefined)).toEqual({
            x: 5,
            y: 0,
        });
        expect(autoPanOffset({ x: 0, y: 600 }, SIZE, {})).toEqual({
            x: 10,
            y: -10,
        });
        // past the edge it pans at full speed
        expect(autoPanOffset({ x: 900, y: -50 }, SIZE, true)).toEqual({
            x: -10,
            y: 10,
        });
        expect(
            autoPanOffset({ x: 790, y: 300 }, SIZE, { speed: 20, margin: 40 }),
        ).toEqual({ x: -15, y: 0 });
    });

    it("does not pan when off or without a size", () => {
        expect(autoPanOffset({ x: 0, y: 0 }, SIZE, false)).toEqual({
            x: 0,
            y: 0,
        });
        expect(
            autoPanOffset({ x: 0, y: 0 }, { width: 0, height: 0 }, true),
        ).toEqual({ x: 0, y: 0 });
    });
});

/** The flow point under a client point at a viewport (the root at the page's origin). */
const under = (viewport: Viewport, clientX: number, clientY: number) =>
    toFlow(viewport, { x: clientX, y: clientY });

describe("dragging a node near the edge", () => {
    const dragged = (engine?: FlowEngineOptions) => {
        const frames = installFrames();
        const flow = mount(flowOf({ a: [300, 250], b: [0, 0] }), {
            features: [selection(), drag()],
            sizes: { a: [100, 50], b: [10, 10] },
            ...(engine ? { engine } : {}),
        });
        // grabbed 20, 10 into the node
        pointer(flow.node("a"), "pointerdown", at(320, 260));
        return { frames, ...flow };
    };
    const positionOf = (flow: ReturnType<typeof dragged>) =>
        flow.model.get("absolute-position-by", { nodeId: "a" });

    it.each([
        ["left", at(5, 300), { x: 1, y: 0 }],
        ["right", at(795, 300), { x: -1, y: 0 }],
        ["top", at(400, 5), { x: 0, y: 1 }],
        ["bottom", at(400, 595), { x: 0, y: -1 }],
    ])(
        "pans by the %s edge, the node staying under the pointer",
        (_edge, point, sign) => {
            const flow = dragged();
            pointer(flow.root, "pointermove", point);
            expect(flow.engine.get("viewport")).toEqual({
                x: 0,
                y: 0,
                zoom: 1,
            });
            expect(flow.frames.pending).toBe(1);
            for (let i = 0; i < 5; i++) flow.frames.frame();
            const viewport = flow.engine.get("viewport");
            expect(Math.sign(viewport.x)).toBe(sign.x);
            expect(Math.sign(viewport.y)).toBe(sign.y);
            // 25 px in from the edge: a sixth of the speed, five frames
            expect(Math.abs(viewport.x + viewport.y)).toBeCloseTo(
                5 * 10 * (1 - 5 / 30),
            );
            const pointerAt = under(viewport, point.clientX, point.clientY);
            expect(positionOf(flow)).toEqual({
                x: expect.closeTo(pointerAt.x - 20),
                y: expect.closeTo(pointerAt.y - 10),
            });
            expect(
                flow.events.filter((e) => e.type === "viewport-change"),
            ).toHaveLength(5);
            expect(
                flow.events.find((e) => e.type === "viewport-change"),
            ).toMatchObject({ gesture: true });
            // the drop is where the pointer is in the flow
            pointer(flow.root, "pointerup", point);
            expect(flow.frames.pending).toBe(0);
            expect(positionOf(flow)).toEqual({
                x: expect.closeTo(pointerAt.x - 20),
                y: expect.closeTo(pointerAt.y - 10),
            });
        },
    );

    it("stops when the pointer leaves the edge, and on a cancel", () => {
        const flow = dragged();
        pointer(flow.root, "pointermove", at(5, 300));
        flow.frames.frame();
        pointer(flow.root, "pointermove", at(400, 300));
        flow.frames.frame();
        expect(flow.frames.pending).toBe(0);
        const still = flow.engine.get("viewport");
        flow.frames.flush();
        expect(flow.engine.get("viewport")).toEqual(still);
        pointer(flow.root, "pointermove", at(5, 300));
        expect(flow.frames.pending).toBe(1);
        key(flow.root, "Escape");
        expect(flow.frames.pending).toBe(0);
        expect(flow.engine.is("dragging")).toBe(false);
    });

    it("does not pan with autoPan off, nor past the translate extent", () => {
        const off = dragged({ autoPan: false });
        pointer(off.root, "pointermove", at(5, 300));
        expect(off.frames.pending).toBe(0);
        // turned off while it runs
        off.engine.adapter.setOptions({ autoPan: true });
        pointer(off.root, "pointermove", at(4, 300));
        expect(off.frames.pending).toBe(1);
        off.engine.adapter.setOptions({ autoPan: false });
        off.frames.flush();
        expect(off.engine.get("viewport")).toEqual({ x: 0, y: 0, zoom: 1 });
        unmountAll();

        const kept = dragged({
            translateExtent: { x: -15, y: 0, width: 2000, height: 2000 },
        });
        pointer(kept.root, "pointermove", at(0, 300));
        kept.frames.flush();
        // 15 flow units left of the view, no more
        expect(kept.engine.get("viewport")).toEqual({ x: 15, y: 0, zoom: 1 });
        expect(kept.frames.pending).toBe(0);
        const pointerAt = under(kept.engine.get("viewport"), 0, 300);
        expect(positionOf(kept)).toEqual({
            x: pointerAt.x - 20,
            y: pointerAt.y - 10,
        });
    });

    it("takes its speed and margin from the option, and does not pan a pane drag", () => {
        const flow = dragged({ autoPan: { speed: 4, margin: 100 } });
        pointer(flow.root, "pointermove", at(50, 300));
        flow.frames.frame();
        expect(flow.engine.get("viewport").x).toBeCloseTo(2);
        pointer(flow.root, "pointerup", at(50, 300));
        // a pan's pointer near the edge pans with the pointer only
        pointer(flow.root, "pointerdown", at(400, 300));
        pointer(flow.root, "pointermove", at(2, 300));
        expect(flow.frames.pending).toBe(0);
    });
});

const handles: HandleSpec[] = [
    {
        nodeId: "a",
        handleId: "out",
        type: "source",
        side: "right",
        x: 95,
        y: 20,
    },
    { nodeId: "b", handleId: "in", type: "target", side: "left", x: -5, y: 20 },
];
const pair = () =>
    flowOf(
        { a: [100, 100], b: [500, 100] },
        {
            edges: [
                {
                    id: "e",
                    source: "a",
                    sourceHandle: "out",
                    target: "b",
                    targetHandle: "in",
                },
            ],
        },
    );

describe("the other gestures near the edge", () => {
    it("pans a connection, its line's end staying under the pointer", () => {
        const frames = installFrames();
        const flow = mount(flowOf({ a: [100, 100], b: [500, 100] }), {
            features: [connection()],
            sizes: { a: [100, 50], b: [100, 50] },
            handles,
        });
        pointer(flow.handle("a", "source", "out"), "pointerdown", at(200, 125));
        pointer(flow.root, "pointermove", at(400, 595));
        frames.frame();
        frames.frame();
        const viewport = flow.engine.get("viewport");
        expect(viewport.y).toBeLessThan(0);
        expect(flow.engine.get("connection")?.toPoint).toEqual(
            under(viewport, 400, 595),
        );
    });

    it("pans a reconnection, its line's end staying under the pointer", () => {
        const frames = installFrames();
        const flow = mount(pair(), {
            features: [connection(), reconnection()],
            sizes: { a: [100, 50], b: [100, 50] },
            handles,
        });
        pointer(flow.edge("e"), "pointerdown", at(493, 125));
        pointer(flow.root, "pointermove", at(798, 125));
        frames.frame();
        const viewport = flow.engine.get("viewport");
        expect(viewport.x).toBeLessThan(0);
        expect(flow.engine.get("connection")).toMatchObject({
            reconnecting: { edgeId: "e", end: "target" },
            toPoint: under(viewport, 798, 125),
        });
    });

    it("pans a selection box, its first corner kept on its flow point", () => {
        const frames = installFrames();
        const flow = mount(flowOf({ a: [100, 320], b: [-60, 320] }), {
            features: [selection({ boxOnDrag: true })],
            sizes: { a: [50, 50], b: [50, 50] },
        });
        pointer(flow.root, "pointerdown", at(300, 300));
        pointer(flow.root, "pointermove", at(0, 400));
        expect(flow.model.get("selected-nodes").map((n) => n.id)).toEqual([
            "a",
        ]);
        for (let i = 0; i < 8; i++) frames.frame();
        const viewport = flow.engine.get("viewport");
        expect(viewport).toEqual({ x: 80, y: 0, zoom: 1 });
        // the box grew over b, now under the pointer's side
        expect(flow.engine.get("selection-box")).toEqual({
            x: 0,
            y: 300,
            width: 380,
            height: 100,
        });
        expect(
            flow.model
                .get("selected-nodes")
                .map((n) => n.id)
                .sort(),
        ).toEqual(["a", "b"]);
    });

    it("pans a resize, the dragged corner staying under the pointer", () => {
        const frames = installFrames();
        const flow = mount(flowOf({ n: [600, 400] }), {
            features: [resize()],
            sizes: { n: [100, 50] },
        });
        const handle = document.createElement("div");
        handle.setAttribute("data-flow-part", "resize-handle");
        handle.setAttribute("data-position", "bottom-right");
        flow.node("n").append(handle);
        pointer(handle, "pointerdown", at(700, 450));
        pointer(flow.root, "pointermove", at(790, 590));
        frames.frame();
        frames.frame();
        const viewport = flow.engine.get("viewport");
        expect(viewport.x).toBeLessThan(0);
        expect(viewport.y).toBeLessThan(0);
        const corner = under(viewport, 790, 590);
        const node = flow.model.get("node-by", { id: "n" });
        expect(node?.width).toBeCloseTo(corner.x - 600);
        expect(node?.height).toBeCloseTo(corner.y - 400);
    });
});
