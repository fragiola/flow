// @vitest-environment jsdom
// An edge's own `pathOptions` (over the engine's, its type's keys) and its `animated` flag
// (`data-animated` on its parts, set by `edge.set-flags`, synced by `commands-to`).
import { afterEach, describe, expect, it } from "vitest";
import type { FlowEdgeInput, FlowJson } from "../../src/document/types";
import { validateFlow } from "../../src/document/validate-flow";
import { createFlowModel } from "../../src/model/create-flow-model";
import { flowOf, mount, unmountAll } from "./harness";

afterEach(unmountAll);

// a leaves by its bottom at (50, 50); b, at (300, 200), is entered by its top at (350, 200)
const json = (edges: FlowEdgeInput[]): FlowJson =>
    flowOf({ a: [0, 0], b: [300, 200] }, { edges });
const sizes = { a: [100, 50], b: [100, 50] } as Record<
    string,
    [number, number]
>;

describe("an edge's pathOptions", () => {
    it("win over the engine's, each key on its own", () => {
        const pathOf = (edge: Partial<FlowEdgeInput>) =>
            mount(json([{ id: "e", source: "a", target: "b", ...edge }]), {
                sizes,
                engine: { pathOptions: { centerY: 100, curvature: 0 } },
            }).engine.get("edge-path-by", { edgeId: "e" })?.path;
        // the engine's centerY for the edge without its own
        expect(pathOf({ type: "step" })).toBe(
            "M50,50 L50,100 L350,100 L350,200",
        );
        // the edge's stepPosition does not drop the engine's centerY, which still wins over it
        expect(
            pathOf({ type: "step", pathOptions: { stepPosition: 0.75 } }),
        ).toBe("M50,50 L50,100 L350,100 L350,200");
        // the edge's centerY over the engine's
        expect(pathOf({ type: "step", pathOptions: { centerY: 150 } })).toBe(
            "M50,50 L50,150 L350,150 L350,200",
        );
        // the edge's curvature over the engine's 0: the control points 150 out
        expect(pathOf({ pathOptions: { curvature: 1 } })).toBe(
            "M50,50 C50,200 350,50 350,200",
        );
    });

    it("place the turn by the edge's own stepPosition", () => {
        const { engine } = mount(
            json([
                {
                    id: "own",
                    source: "a",
                    target: "b",
                    type: "smoothstep",
                    pathOptions: { stepPosition: 0.2, borderRadius: 0 },
                },
            ]),
            { sizes },
        );
        expect(engine.get("edge-path-by", { edgeId: "own" })?.path).toBe(
            "M50,50 L50,92 L350,92 L350,200",
        );
    });

    it("ignore an engine stepPosition, centerX or centerY that is not a finite number", () => {
        const pathOf = (pathOptions: Record<string, number>) =>
            mount(json([{ id: "e", source: "a", target: "b", type: "step" }]), {
                sizes,
                engine: { pathOptions },
            }).engine.get("edge-path-by", { edgeId: "e" })?.path;
        const plain = "M50,50 L50,125 L350,125 L350,200";
        expect(pathOf({})).toBe(plain);
        expect(pathOf({ stepPosition: Number.NaN })).toBe(plain);
        expect(pathOf({ centerY: Number.NaN })).toBe(plain);
        expect(pathOf({ centerX: Number.NaN, centerY: Infinity })).toBe(plain);
    });

    it("are checked by the document's schema", () => {
        const flow = json([
            {
                id: "e",
                source: "a",
                target: "b",
                pathOptions: { wobble: 1 } as never,
            },
        ]);
        expect(validateFlow(flow)).toMatchObject([
            { path: "/edges/0/pathOptions/wobble" },
        ]);
        const negative = json([
            {
                id: "e",
                source: "a",
                target: "b",
                pathOptions: { stepPosition: -1 },
            },
        ]);
        expect(validateFlow(negative)).toMatchObject([
            { path: "/edges/0/pathOptions/stepPosition" },
        ]);
    });

    it("replace the edge when a controlled sync changes them", () => {
        const model = createFlowModel(
            json([{ id: "e", source: "a", target: "b" }]),
        );
        const same = model.get("commands-to", {
            edges: [{ id: "e", source: "a", target: "b", pathOptions: {} }],
        });
        expect(same).toEqual([]);
        const changed = model.get("commands-to", {
            edges: [
                {
                    id: "e",
                    source: "a",
                    target: "b",
                    pathOptions: { curvature: 1 },
                },
            ],
        });
        expect(changed.map((entry) => entry.command)).toEqual([
            "edge.remove",
            "edge.add",
        ]);
        model.run("batch", { commands: [...changed] });
        expect(model.get("edge-by", { id: "e" })?.pathOptions).toEqual({
            curvature: 1,
        });
    });
});

describe("an edge's animated flag", () => {
    it("toggles data-animated on the edge's parts", () => {
        const { engine, model } = mount(
            json([{ id: "e", source: "a", target: "b" }]),
            { sizes },
        );
        for (const part of ["edge", "edge-path", "edge-label"] as const) {
            expect(
                engine.adapter.attributes(part, { edgeId: "e" })[
                    "data-animated"
                ],
            ).toBeUndefined();
        }
        expect(
            model.run("edge.set-flags", { edgeId: "e", animated: true }).ok,
        ).toBe(true);
        for (const part of ["edge", "edge-path", "edge-label"] as const) {
            expect(
                engine.adapter.attributes(part, { edgeId: "e" })[
                    "data-animated"
                ],
            ).toBe("");
        }
        model.run("edge.set-flags", { edgeId: "e", animated: false });
        expect(
            engine.adapter.attributes("edge", { edgeId: "e" })["data-animated"],
        ).toBeUndefined();
    });

    it("is synced by edge.set-flags, never by replacing the edge", () => {
        const model = createFlowModel(
            json([{ id: "e", source: "a", target: "b" }]),
        );
        const commands = model.get("commands-to", {
            edges: [{ id: "e", source: "a", target: "b", animated: true }],
        });
        expect(commands).toEqual([
            {
                command: "edge.set-flags",
                payload: { edgeId: "e", animated: true },
            },
        ]);
    });
});
