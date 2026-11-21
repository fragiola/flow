// @vitest-environment jsdom
// The part attributes (D11): `data-flow-part` and `data-flow-id` on every part, boolean state
// attributes present as "" or absent, from one core helper every adapter spreads.
import { afterEach, describe, expect, it } from "vitest";
import { flag, partAttributes } from "../../src/attributes/part-attributes";
import { selection } from "../../src/selection/selection";
import { flowOf, mount, unmountAll } from "../engine/harness";

afterEach(unmountAll);

describe("part attributes", () => {
    it("give a part its name and id without an engine", () => {
        expect(partAttributes("viewport")).toEqual({
            "data-flow-part": "viewport",
        });
        expect(partAttributes("node", "a")).toEqual({
            "data-flow-part": "node",
            "data-flow-id": "a",
        });
        expect(flag(true)).toBe("");
        expect(flag(false)).toBeUndefined();
    });

    it("give each part its state", () => {
        const json = flowOf(
            { a: [0, 0], b: [200, 0] },
            { edges: [{ id: "ab", source: "a", target: "b", selected: true }] },
        );
        json.nodes[0] = {
            ...json.nodes[0],
            selected: true,
        } as (typeof json.nodes)[0];
        json.nodes[1] = {
            ...json.nodes[1],
            connectable: false,
        } as (typeof json.nodes)[1];
        const { engine } = mount(json, {
            features: [selection()],
            sizes: { a: [100, 50] },
        });
        const { attributes } = engine.adapter;
        expect(attributes("node", { nodeId: "a" })).toEqual({
            "data-flow-part": "node",
            "data-flow-id": "a",
            "data-selected": "",
            "data-hidden": undefined,
            "data-measured": "",
        });
        expect(attributes("node", { nodeId: "b" })).toMatchObject({
            "data-selected": undefined,
            "data-measured": undefined,
        });
        expect(attributes("edge", { edgeId: "ab" })).toEqual({
            "data-flow-part": "edge",
            "data-flow-id": "ab",
            "data-selected": "",
        });
        expect(attributes("edge-label", { edgeId: "ab" })["data-flow-id"]).toBe(
            "ab",
        );
        expect(
            attributes("handle", { nodeId: "b", type: "target", side: "top" }),
        ).toEqual({
            "data-flow-part": "handle",
            "data-flow-id": undefined,
            "data-handle-type": "target",
            "data-side": "top",
            "data-connectable": undefined,
        });
        expect(
            attributes("resize-handle", { nodeId: "a", position: "top-left" }),
        ).toEqual({
            "data-flow-part": "resize-handle",
            "data-position": "top-left",
        });
        expect(attributes("minimap-node", { nodeId: "a" })).toEqual({
            "data-flow-part": "minimap-node",
            "data-flow-id": "a",
            "data-selected": "",
        });
        expect(attributes("toolbar", { nodeId: "a" })).toEqual({
            "data-flow-part": "toolbar",
            "data-flow-id": "a",
        });
        expect(attributes("background")).toEqual({
            "data-flow-part": "background",
        });
        expect(Object.isFrozen(attributes("controls"))).toBe(true);
    });
});
