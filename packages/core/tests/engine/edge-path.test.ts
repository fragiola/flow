// @vitest-environment jsdom
// `edge-path-by` (D9): an edge's path, label point and ends for the five built-in types, at its
// handles' centres or its nodes' default sides, on fixed fixtures with our own expected values.
import { afterEach, describe, expect, it } from "vitest";
import type { FlowJson } from "../../src/document/types";
import type { HandleSpec } from "./harness";
import { mount, unmountAll } from "./harness";

afterEach(unmountAll);

const TYPES = [
    "bezier",
    "simplebezier",
    "smoothstep",
    "step",
    "straight",
    "custom",
] as const;

const json: FlowJson = {
    version: 1,
    nodes: [
        { id: "a", type: "default", position: { x: 0, y: 0 }, data: {} },
        { id: "b", type: "default", position: { x: 300, y: 100 }, data: {} },
        { id: "c", type: "default", position: { x: 0, y: 200 }, data: {} },
        { id: "d", type: "default", position: { x: 0, y: 400 }, data: {} },
        { id: "lazy", type: "default", position: { x: 0, y: 0 }, data: {} },
    ],
    edges: [
        ...TYPES.map((type) => ({
            id: type,
            source: "a",
            sourceHandle: `out-${type}`,
            target: "b",
            targetHandle: `in-${type}`,
            type,
        })),
        { id: "plain", source: "c", target: "d" },
        { id: "unmeasured", source: "c", target: "lazy" },
    ],
};

// a's source handles on its right side, centred at (100, 25); b's target handles on its left, at (300, 125)
const handles: HandleSpec[] = TYPES.flatMap((type) => [
    {
        nodeId: "a",
        handleId: `out-${type}`,
        type: "source",
        side: "right",
        x: 95,
        y: 20,
    },
    {
        nodeId: "b",
        handleId: `in-${type}`,
        type: "target",
        side: "left",
        x: -5,
        y: 20,
    },
]);

const ends = {
    source: { x: 100, y: 25 },
    sourceSide: "right",
    target: { x: 300, y: 125 },
    targetSide: "left",
};

describe("edge-path-by", () => {
    const flow = () =>
        mount(json, {
            sizes: { a: [100, 50], b: [100, 50], c: [100, 50], d: [100, 50] },
            handles,
        }).engine;

    it("draws a bezier between the handles' centres", () => {
        expect(flow().get("edge-path-by", { edgeId: "bezier" })).toEqual({
            ...ends,
            path: "M100,25 C200,25 200,125 300,125",
            label: { x: 200, y: 75 },
        });
    });

    it("draws a smooth step, a step and a straight line", () => {
        const engine = flow();
        expect(engine.get("edge-path-by", { edgeId: "smoothstep" })).toEqual({
            ...ends,
            path: "M100,25 L195,25 Q200,25 200,30 L200,120 Q200,125 205,125 L300,125",
            label: { x: 200, y: 75 },
        });
        expect(engine.get("edge-path-by", { edgeId: "step" })).toEqual({
            ...ends,
            path: "M100,25 L200,25 L200,125 L300,125",
            label: { x: 200, y: 75 },
        });
        expect(engine.get("edge-path-by", { edgeId: "straight" })).toEqual({
            ...ends,
            path: "M100,25 L300,125",
            label: { x: 200, y: 75 },
        });
    });

    it("draws a simple bezier, which the bezier's curvature does not change", () => {
        expect(flow().get("edge-path-by", { edgeId: "simplebezier" })).toEqual({
            ...ends,
            path: "M100,25 C200,25 200,125 300,125",
            label: { x: 200, y: 75 },
        });
        const engine = mount(json, {
            sizes: { a: [100, 50], b: [100, 50], c: [100, 50], d: [100, 50] },
            handles,
            engine: { pathOptions: { curvature: 0.25 } },
        }).engine;
        expect(engine.get("edge-path-by", { edgeId: "bezier" })?.path).toBe(
            "M100,25 C150,25 250,125 300,125",
        );
        expect(
            engine.get("edge-path-by", { edgeId: "simplebezier" })?.path,
        ).toBe("M100,25 C200,25 200,125 300,125");
    });

    it("gives an app's type the bezier, for its own primitive to redraw from the ends", () => {
        const engine = flow();
        expect(engine.get("edge-path-by", { edgeId: "custom" })?.path).toBe(
            engine.get("edge-path-by", { edgeId: "bezier" })?.path,
        );
    });

    it("leaves a source by its bottom and enters a target by its top without handles", () => {
        expect(flow().get("edge-path-by", { edgeId: "plain" })).toEqual({
            source: { x: 50, y: 250 },
            sourceSide: "bottom",
            target: { x: 50, y: 400 },
            targetSide: "top",
            path: "M50,250 C50,325 50,325 50,400",
            label: { x: 50, y: 325 },
        });
    });

    it("draws nothing until both nodes have a size, nor for a missing edge", () => {
        const engine = flow();
        expect(
            engine.get("edge-path-by", { edgeId: "unmeasured" }),
        ).toBeUndefined();
        expect(engine.get("edge-path-by", { edgeId: "nope" })).toBeUndefined();
        expect(
            engine.get("visible-edges").map((edge) => edge.id),
        ).not.toContain("unmeasured");
    });

    it("follows the nodes when they move", () => {
        const { engine, model } = mount(json, {
            sizes: { a: [100, 50], b: [100, 50], c: [100, 50], d: [100, 50] },
            handles,
        });
        model.run("node.move", { nodeId: "b", position: { x: 400, y: 100 } });
        expect(engine.get("edge-path-by", { edgeId: "straight" })?.path).toBe(
            "M100,25 L400,125",
        );
    });

    it("takes the engine's path options", () => {
        const { engine } = mount(json, {
            sizes: { a: [100, 50], b: [100, 50], c: [100, 50], d: [100, 50] },
            handles,
            engine: { pathOptions: { borderRadius: 0, curvature: 0.25 } },
        });
        expect(engine.get("edge-path-by", { edgeId: "smoothstep" })?.path).toBe(
            "M100,25 L200,25 L200,125 L300,125",
        );
        expect(engine.get("edge-path-by", { edgeId: "bezier" })?.path).toBe(
            "M100,25 C150,25 250,125 300,125",
        );
    });
});
