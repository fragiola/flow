// @vitest-environment jsdom
// `connection({ clickToConnect })`: a tap on a handle starts a connection that follows the pointer
// without a press; a tap on another handle adds the edge through `model.can("edge.add")` (a veto
// marks it invalid while hovered and refuses it), a tap elsewhere or Escape cancels; the events are
// a drag's. Off by default; dragging from a handle is unchanged.
import { afterEach, describe, expect, it } from "vitest";
import { veto } from "../../src/commands/veto";
import { connection } from "../../src/connection/connection";
import { selection } from "../../src/selection/selection";
import type { HandleSpec } from "../engine/harness";
import { flowOf, key, mount, pointer, unmountAll } from "../engine/harness";

afterEach(unmountAll);

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
    { nodeId: "c", handleId: "in", type: "target", side: "left", x: -5, y: 20 },
];
const sizes = { a: [100, 50], b: [100, 50], c: [100, 50] } as Record<
    string,
    [number, number]
>;
const json = () => flowOf({ a: [0, 0], b: [300, 0], c: [300, 200] });

const at = (clientX: number, clientY: number) => ({ clientX, clientY });

/** A press and a release at one point. */
const tap = (target: Element, point: { clientX: number; clientY: number }) => {
    pointer(target, "pointerdown", point);
    pointer(target, "pointerup", point);
};

const clicking = () =>
    mount(json(), {
        features: [selection(), connection({ clickToConnect: true })],
        sizes,
        handles,
    });

const typesOf = (events: readonly { type: string }[]) =>
    events
        .map((event) => event.type)
        .filter((type) => type !== "viewport-change");

describe("click-to-connect", () => {
    it("starts on a tap, follows the pointer and connects on a tap on another handle", () => {
        const flow = clicking();
        const { engine, root, model, events } = flow;
        tap(flow.handle("a", "source", "out"), at(100, 25));
        expect(engine.get("connection")).toMatchObject({
            from: { nodeId: "a", handleId: "out" },
            fromPoint: { x: 100, y: 25 },
            status: null,
        });
        expect(engine.is("connecting")).toBe(true);
        expect(engine.adapter.attributes("root")["data-connecting"]).toBe("");
        expect(typesOf(events)).toEqual(["connect-start"]);
        // no press: the line follows the pointer, and snaps to a handle near it
        pointer(root, "pointermove", at(200, 60));
        expect(engine.get("connection")).toMatchObject({
            toPoint: { x: 200, y: 60 },
            to: undefined,
        });
        pointer(root, "pointermove", at(295, 30));
        expect(engine.get("connection")).toMatchObject({
            to: { nodeId: "b", handleId: "in" },
            status: "valid",
        });
        tap(flow.handle("b", "target", "in"), at(300, 25));
        expect(engine.get("connection")).toBeNull();
        expect(engine.is("connecting")).toBe(false);
        expect(model.get("all-edges")).toEqual([
            {
                id: "edge-1",
                source: "a",
                sourceHandle: "out",
                target: "b",
                targetHandle: "in",
            },
        ]);
        expect(events.filter((e) => e.type !== "viewport-change")).toEqual([
            {
                type: "connect-start",
                nodeId: "a",
                handleId: "out",
                handleType: "source",
                input: "pointer",
            },
            {
                type: "connect",
                edgeId: "edge-1",
                source: "a",
                target: "b",
                input: "pointer",
            },
        ]);
        // the tap that connects selects nothing
        expect(model.get("selected-nodes")).toEqual([]);
    });

    it("marks a vetoed handle invalid while hovered and refuses a tap on it", () => {
        const flow = clicking();
        flow.model.use((ctx, next) =>
            ctx.command === "edge.add" && ctx.payload.target === "c"
                ? veto("not c")
                : next(),
        );
        tap(flow.handle("a", "source", "out"), at(100, 25));
        pointer(flow.root, "pointermove", at(300, 25));
        expect(flow.engine.get("connection")?.status).toBe("valid");
        pointer(flow.root, "pointermove", at(300, 225));
        expect(flow.engine.get("connection")?.status).toBe("invalid");
        expect(
            flow.engine.adapter.attributes("handle", {
                nodeId: "c",
                handleId: "in",
                type: "target",
                side: "left",
            })["data-invalid"],
        ).toBe("");
        tap(flow.handle("c", "target", "in"), at(300, 225));
        expect(flow.engine.get("connection")).toBeNull();
        expect(flow.model.get("all-edges")).toEqual([]);
        expect(flow.events.at(-1)).toMatchObject({
            type: "connect-cancel",
            refused: true,
            input: "pointer",
        });
    });

    it("cancels on a tap on the pane, and on Escape", () => {
        const flow = clicking();
        flow.model.run("selection.set", { nodeIds: ["b"] });
        tap(flow.handle("a", "source", "out"), at(100, 25));
        tap(flow.root, at(600, 500));
        expect(flow.engine.get("connection")).toBeNull();
        expect(flow.events.at(-1)).toMatchObject({
            type: "connect-cancel",
            refused: false,
            input: "pointer",
        });
        // the tap went to the connection: the selection stays
        expect(flow.model.get("selected-nodes").map((n) => n.id)).toEqual([
            "b",
        ]);
        tap(flow.handle("a", "source", "out"), at(100, 25));
        expect(flow.engine.is("connecting")).toBe(true);
        key(flow.root, "Escape");
        expect(flow.engine.get("connection")).toBeNull();
        expect(typesOf(flow.events).slice(-2)).toEqual([
            "connect-start",
            "connect-cancel",
        ]);
        // and on cancel-gesture
        tap(flow.handle("a", "source", "out"), at(100, 25));
        expect(flow.engine.can("cancel-gesture")).toBe(true);
        expect(flow.engine.run("cancel-gesture").ok).toBe(true);
        expect(flow.engine.is("connecting")).toBe(false);
        expect(flow.model.get("all-edges")).toEqual([]);
    });

    it("is off by default, and leaves drag-to-connect as it was", () => {
        const flow = mount(json(), {
            features: [connection()],
            sizes,
            handles,
        });
        tap(flow.handle("a", "source", "out"), at(100, 25));
        expect(flow.engine.get("connection")).toBeNull();
        expect(flow.events).toEqual([]);
        const clicks = clicking();
        const out = clicks.handle("a", "source", "out");
        pointer(out, "pointerdown", at(100, 25));
        pointer(clicks.root, "pointermove", at(200, 30));
        pointer(clicks.root, "pointermove", at(298, 26));
        pointer(clicks.root, "pointerup", at(298, 26));
        expect(clicks.engine.get("connection")).toBeNull();
        expect(clicks.model.get("all-edges")).toHaveLength(1);
        expect(typesOf(clicks.events)).toEqual(["connect-start", "connect"]);
    });

    it("starts on a tap that jitters within the tap tolerance", () => {
        const flow = clicking();
        const out = flow.handle("a", "source", "out");
        pointer(out, "pointerdown", at(100, 25));
        pointer(flow.root, "pointermove", at(102, 26));
        pointer(flow.root, "pointerup", at(102, 26));
        expect(flow.engine.is("connecting")).toBe(true);
        tap(flow.handle("b", "target", "in"), at(301, 24));
        expect(flow.model.get("all-edges")).toHaveLength(1);
        // past the tolerance, it is a drag again
        const more = clicking();
        pointer(more.handle("a", "source", "out"), "pointerdown", at(100, 25));
        pointer(more.root, "pointermove", at(110, 25));
        expect(more.engine.is("connecting")).toBe(true);
        pointer(more.root, "pointerup", at(110, 25));
        expect(more.engine.is("connecting")).toBe(false);
        expect(typesOf(more.events)).toEqual([
            "connect-start",
            "connect-cancel",
        ]);
    });

    it("cancels on Escape anywhere in the page, on set-interactive false and on destroy", () => {
        const flow = clicking();
        tap(flow.handle("a", "source", "out"), at(100, 25));
        // focus left the root: the key goes to the page's body
        const escapeKey = new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
            cancelable: true,
        });
        document.body.dispatchEvent(escapeKey);
        expect(flow.engine.is("connecting")).toBe(false);
        expect(escapeKey.defaultPrevented).toBe(true);
        expect(flow.events.at(-1)).toMatchObject({
            type: "connect-cancel",
            refused: false,
            input: "pointer",
        });
        tap(flow.handle("a", "source", "out"), at(100, 25));
        flow.engine.run("set-interactive", { interactive: false });
        expect(flow.engine.is("connecting")).toBe(false);
        expect(flow.events.at(-1)?.type).toBe("connect-cancel");
        flow.engine.run("set-interactive", { interactive: true });
        tap(flow.handle("a", "source", "out"), at(100, 25));
        expect(flow.engine.is("connecting")).toBe(true);
        const before = flow.events.length;
        flow.engine.destroy();
        expect(flow.events.slice(before).map((e) => e.type)).toEqual([
            "connect-cancel",
        ]);
        // nothing follows the pointer any more
        pointer(flow.root, "pointermove", at(200, 60));
        expect(flow.events).toHaveLength(before + 1);
    });
});
