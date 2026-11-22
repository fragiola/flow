// @vitest-environment jsdom
// `render-layers` and the `zIndexMode` option: a flow whose edges all stand at or below the lowest
// node gets one level (today's DOM, `node-z-index-by` unchanged); otherwise each distinct edge value
// above it starts a level, and the structural z-indexes become negative ranks. Also the
// `edges-layer` part's attributes and `adapter.refocus`, which gives focus back to an edge that
// moved to another level's layer (it remounts).
import { afterEach, describe, expect, it } from "vitest";
import type { FlowJson } from "../../src/document/types";
import { staticGeometry } from "../../src/geometry/static-geometry";
import { selection } from "../../src/selection/selection";
import { subflows } from "../../src/subflows/subflows";
import { flowOf, mount, unmountAll } from "./harness";

afterEach(unmountAll);

const sizes = { a: [50, 50], b: [50, 50], c: [50, 50] } as Record<
    string,
    [number, number]
>;

const flat = (extra: Partial<FlowJson> = {}): FlowJson =>
    flowOf(
        { a: [0, 0], b: [200, 0], c: [400, 0] },
        {
            edges: [
                { id: "ab", source: "a", target: "b" },
                { id: "bc", source: "b", target: "c" },
            ],
            ...extra,
        },
    );

const zs = (
    engine: {
        get(key: "node-z-index-by", payload: { nodeId: string }): number;
    },
    ids: string[],
) =>
    Object.fromEntries(
        ids.map((nodeId) => [
            nodeId,
            engine.get("node-z-index-by", { nodeId }),
        ]),
    );

describe("render-layers", () => {
    it("is one level when no edge stands above a node, node-z-index-by unchanged", () => {
        const { engine } = mount(flat(), { sizes });
        expect(engine.get("render-layers")).toEqual([
            {
                level: 0,
                zIndex: undefined,
                nodeIds: ["a", "b", "c"],
                edgeIds: ["ab", "bc"],
            },
        ]);
        expect(zs(engine, ["a", "b", "c"])).toEqual({ a: 0, b: 0, c: 0 });
    });

    it("lifts a selected edge above the nodes in auto (the default), not in basic", () => {
        const flow = mount(flat(), { sizes, features: [selection()] });
        flow.model.run("selection.set", { edgeIds: ["ab"] });
        expect(flow.engine.get("render-layers")).toEqual([
            { level: 0, zIndex: -3, nodeIds: ["a", "b", "c"], edgeIds: ["bc"] },
            { level: 1, zIndex: -1, nodeIds: [], edgeIds: ["ab"] },
        ]);
        expect(zs(flow.engine, ["a", "b", "c"])).toEqual({
            a: -2,
            b: -2,
            c: -2,
        });
        // without the raise, one level again
        flow.engine.adapter.setOptions({ elevateEdgesOnSelect: false });
        expect(flow.engine.get("render-layers")).toHaveLength(1);
        flow.engine.adapter.setOptions({
            elevateEdgesOnSelect: true,
            zIndexMode: "basic",
        });
        expect(flow.engine.get("render-layers")).toEqual([
            {
                level: 0,
                zIndex: undefined,
                nodeIds: ["a", "b", "c"],
                edgeIds: ["bc", "ab"],
            },
        ]);
    });

    it("keeps a selected node above a selected edge (an equal value stays below the node)", () => {
        const flow = mount(flat(), { sizes, features: [selection()] });
        flow.model.run("selection.set", { nodeIds: ["b"], edgeIds: ["ab"] });
        expect(flow.engine.get("render-layers")).toEqual([
            { level: 0, zIndex: -4, nodeIds: ["a", "c"], edgeIds: ["bc"] },
            { level: 1, zIndex: -2, nodeIds: ["b"], edgeIds: ["ab"] },
        ]);
        expect(zs(flow.engine, ["a", "b", "c"])).toEqual({
            a: -3,
            b: -1,
            c: -3,
        });
    });

    it("draws an edge whose zIndex exceeds its nodes' above them, in every mode but basic", () => {
        const json = flat({
            edges: [
                { id: "ab", source: "a", target: "b", zIndex: 4 },
                { id: "bc", source: "b", target: "c" },
            ],
        });
        json.nodes[2] = {
            ...json.nodes[2],
            zIndex: 9,
        } as (typeof json.nodes)[2];
        for (const zIndexMode of ["auto", "manual"] as const) {
            const { engine } = mount(json, { sizes, engine: { zIndexMode } });
            expect(engine.get("render-layers"), zIndexMode).toEqual([
                { level: 0, zIndex: -4, nodeIds: ["a", "b"], edgeIds: ["bc"] },
                { level: 1, zIndex: -2, nodeIds: ["c"], edgeIds: ["ab"] },
            ]);
            // the ranks: bc, a and b, ab, c
            expect(zs(engine, ["a", "b", "c"])).toEqual({
                a: -3,
                b: -3,
                c: -1,
            });
        }
        const basic = mount(json, { sizes, engine: { zIndexMode: "basic" } });
        expect(basic.engine.get("render-layers")).toHaveLength(1);
        expect(zs(basic.engine, ["a", "b", "c"])).toEqual({ a: 0, b: 0, c: 9 });
    });

    it("draws a child's edge above its parent in auto, and only by zIndex in manual", () => {
        const json: FlowJson = {
            version: 1,
            nodes: [
                { id: "p", type: "group", position: { x: 0, y: 0 }, data: {} },
                {
                    id: "c",
                    type: "default",
                    position: { x: 10, y: 10 },
                    parentId: "p",
                    data: {},
                },
                {
                    id: "o",
                    type: "default",
                    position: { x: 400, y: 0 },
                    data: {},
                },
            ],
            edges: [
                { id: "co", source: "c", target: "o" },
                { id: "po", source: "p", target: "o" },
            ],
        };
        const nested = {
            features: [subflows()],
            sizes: { p: [200, 200], c: [50, 50], o: [50, 50] } as Record<
                string,
                [number, number]
            >,
        };
        const auto = mount(json, nested);
        expect(auto.engine.get("render-layers")).toEqual([
            { level: 0, zIndex: -4, nodeIds: ["p", "o"], edgeIds: ["po"] },
            { level: 1, zIndex: -2, nodeIds: ["c"], edgeIds: ["co"] },
        ]);
        expect(zs(auto.engine, ["p", "c", "o"])).toEqual({
            p: -3,
            c: -1,
            o: -3,
        });
        // "manual": the child is not raised above its parent, its edge stays at 0
        const manual = mount(json, {
            ...nested,
            engine: { zIndexMode: "manual" },
        });
        expect(manual.engine.get("render-layers")).toHaveLength(1);
        expect(zs(manual.engine, ["p", "c", "o"])).toEqual({
            p: 0,
            c: 0,
            o: 0,
        });
    });

    it("keeps the edge of a selected group's children above the group, below them, as the static geometry", () => {
        const json: FlowJson = {
            version: 1,
            nodes: [
                { id: "g", type: "group", position: { x: 0, y: 0 }, data: {} },
                {
                    id: "a",
                    type: "default",
                    position: { x: 10, y: 10 },
                    parentId: "g",
                    data: {},
                },
                {
                    id: "b",
                    type: "default",
                    position: { x: 100, y: 10 },
                    parentId: "g",
                    data: {},
                },
            ],
            edges: [{ id: "ab", source: "a", target: "b" }],
        };
        const flow = mount(json, {
            features: [subflows(), selection()],
            sizes: { g: [200, 100], a: [50, 50], b: [50, 50] },
        });
        flow.model.run("selection.set", { nodeIds: ["g"] });
        const layers = [
            { level: 0, zIndex: -4, nodeIds: ["g"], edgeIds: [] },
            { level: 1, zIndex: -2, nodeIds: ["a", "b"], edgeIds: ["ab"] },
        ];
        expect(flow.engine.get("render-layers")).toEqual(layers);
        expect(zs(flow.engine, ["g", "a", "b"])).toEqual({
            g: -3,
            a: -1,
            b: -1,
        });
        const sized = flow.model.get("flow-json");
        const geometry = staticGeometry({
            ...sized,
            nodes: sized.nodes.map((node) => ({
                ...node,
                width: node.id === "g" ? 200 : 50,
                height: node.id === "g" ? 100 : 50,
            })),
        });
        expect(geometry.layers).toEqual(layers);
        expect(geometry.nodeZIndexes).toEqual({ g: -3, a: -1, b: -1 });
    });

    it("follows the drawn edges: a hidden edge or an unmeasured node's edge is in no level", () => {
        const json = flat({
            edges: [
                { id: "ab", source: "a", target: "b", zIndex: 2, hidden: true },
                { id: "bc", source: "b", target: "c", zIndex: 2 },
            ],
        });
        const flow = mount(json, { sizes: { a: [50, 50], b: [50, 50] } });
        expect(flow.engine.get("render-layers")).toHaveLength(1);
        flow.sizes.set("c", [50, 50]);
        flow.observer()?.trigger([flow.node("c")]);
        expect(flow.engine.get("render-layers")).toEqual([
            { level: 0, zIndex: -3, nodeIds: ["a", "b", "c"], edgeIds: [] },
            { level: 1, zIndex: -1, nodeIds: [], edgeIds: ["bc"] },
        ]);
    });
});

describe("the edges-layer part", () => {
    it("carries its level, and a press on it is the pane's", () => {
        const flow = mount(flat(), { sizes });
        expect(
            flow.engine.adapter.attributes("edges-layer", { level: 2 }),
        ).toEqual({ "data-flow-part": "edges-layer", "data-level": "2" });
        const layer = document.createElement("div");
        layer.setAttribute("data-flow-part", "edges-layer");
        layer.setAttribute("data-level", "1");
        flow.viewport.append(layer);
        const events: string[] = [];
        flow.engine.subscribe((event) => events.push(event.type));
        layer.dispatchEvent(
            new MouseEvent("pointerdown", { bubbles: true, button: 0 }),
        );
        layer.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
        expect(events).toContain("pane-click");
    });
});

describe("adapter.refocus", () => {
    const edgeElement = (flow: ReturnType<typeof mount>, edgeId: string) => {
        const element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "g",
        );
        element.setAttribute("data-flow-part", "edge");
        element.setAttribute("data-flow-id", edgeId);
        element.setAttribute("tabindex", "0");
        flow.viewport.append(element);
        return element;
    };

    it("focuses a remounted part that had focus, once focus was lost", () => {
        const flow = mount(flat(), { sizes });
        const before = edgeElement(flow, "ab");
        before.focus();
        expect(document.activeElement).toBe(before);
        before.remove();
        expect([null, document.body]).toContain(document.activeElement);
        const after = edgeElement(flow, "ab");
        flow.engine.adapter.refocus(after);
        expect(document.activeElement).toBe(after);
    });

    it("forgets a part blurred while it stays in the document", async () => {
        const flow = mount(flat(), { sizes });
        const before = edgeElement(flow, "ab");
        before.focus();
        // the user clicks outside: focus goes to the body, the edge stays
        before.blur();
        expect(document.activeElement).toBe(document.body);
        await Promise.resolve();
        before.remove();
        const after = edgeElement(flow, "ab");
        flow.engine.adapter.refocus(after);
        expect(document.activeElement).toBe(document.body);
    });

    it("leaves focus alone for another part, or when something else has it", () => {
        const flow = mount(flat(), { sizes });
        const before = edgeElement(flow, "ab");
        before.focus();
        before.remove();
        const other = edgeElement(flow, "bc");
        flow.engine.adapter.refocus(other);
        expect(document.activeElement).not.toBe(other);
        // focus went elsewhere: the remounted edge does not take it
        flow.node("a").focus();
        const again = edgeElement(flow, "ab");
        flow.engine.adapter.refocus(again);
        expect(document.activeElement).toBe(flow.node("a"));
    });
});
