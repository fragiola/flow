import {
    type AnyTypes,
    createFlowModel,
    type FlowEdge,
    type FlowNode,
} from "@fragiola/flow-angular";
import { describe, expect, it } from "vitest";
import {
    afterCopy,
    afterCut,
    cascade,
    copyOf,
    cornerOf,
    KIND,
    OFFSET,
    parse,
    pasted,
    serialize,
    shiftFor,
} from "../src/examples/copy-paste/clipboard";

// The copy-paste example's clipboard: what a copy keeps (the nodes and only the edges between
// them), the marked JSON it travels as (foreign text ignored), where each paste goes, and the new
// ids a paste gives.

const node = (id: string, x: number, y: number, selected = false): FlowNode =>
    ({
        id,
        type: "step",
        position: { x, y },
        data: { label: id },
        ...(selected ? { selected } : {}),
    }) as FlowNode;

const edge = (source: string, target: string): FlowEdge =>
    ({ id: `${source}-${target}`, source, target }) as FlowEdge;

const nodes = [node("a", 0, 0), node("b", 200, 50), node("c", 400, 0)];
const edges = [edge("a", "b"), edge("b", "c")];

describe("copyOf", () => {
    it("keeps the named nodes and only the edges between two of them, unselected", () => {
        const chosen = [
            node("a", 0, 0, true),
            node("b", 200, 50, true),
            nodes[2] as FlowNode,
        ];
        const payload = copyOf<AnyTypes>(chosen, edges, ["a", "b"]);
        expect(payload.kind).toBe(KIND);
        expect(payload.version).toBe(1);
        expect(payload.nodes.map((n) => n.id)).toEqual(["a", "b"]);
        expect(payload.nodes.every((n) => n.selected === undefined)).toBe(true);
        expect(payload.edges.map((e) => e.id)).toEqual(["a-b"]);
    });

    it("keeps no edge for a single node", () => {
        expect(copyOf<AnyTypes>(nodes, edges, ["b"]).edges).toEqual([]);
    });
});

describe("serialize and parse", () => {
    it("reads back what it wrote", () => {
        const payload = copyOf<AnyTypes>(nodes, edges, ["a", "b"]);
        expect(parse(serialize(payload))).toEqual(payload);
    });

    it("ignores text that is not this app's payload", () => {
        const good = copyOf<AnyTypes>(nodes, edges, ["a", "b"]);
        for (const text of [
            undefined,
            null,
            "",
            "hello",
            "{",
            "[]",
            JSON.stringify({ ...good, kind: "something-else" }),
            JSON.stringify({ ...good, version: 2 }),
            JSON.stringify({ ...good, nodes: [] }),
            JSON.stringify({ ...good, nodes: [{ id: "a" }] }),
            JSON.stringify({
                ...good,
                nodes: [{ ...good.nodes[0], position: { x: "1", y: 0 } }],
            }),
            JSON.stringify({ ...good, edges: [{ id: "x", source: "a" }] }),
            // an edge to a node the payload does not hold
            JSON.stringify({ ...good, edges: [edge("a", "c")] }),
        ]) {
            expect(parse(text), String(text)).toBeUndefined();
        }
    });
});

describe("cascade", () => {
    it("moves each paste one step further from the copy's place", () => {
        const first = cascade(afterCopy, undefined);
        expect(first.step).toBe(1);
        const second = cascade(first.next, undefined);
        expect(second.step).toBe(2);
    });

    it("puts the first paste after a cut back in place", () => {
        expect(cascade(afterCut, undefined).step).toBe(0);
    });

    it("pastes on a pointer, then one step further while the pointer stays", () => {
        const at = { x: 10, y: 20 };
        const first = cascade(afterCopy, at);
        expect(first.step).toBe(0);
        const second = cascade(first.next, { ...at });
        expect(second.step).toBe(1);
        // a new pointer starts again on it
        expect(cascade(second.next, { x: 99, y: 20 }).step).toBe(0);
        // no pointer: one step from the copy's place
        expect(cascade(second.next, undefined).step).toBe(1);
    });

    it("counts the pastes at the copy's place and at the pointer apart", () => {
        const at = { x: 10, y: 20 };
        const copy1 = cascade(afterCopy, undefined);
        const copy2 = cascade(copy1.next, undefined);
        expect(copy2.step).toBe(2);
        // pastes under the pointer in between
        const pointer1 = cascade(copy2.next, at);
        expect(pointer1.step).toBe(0);
        const pointer2 = cascade(pointer1.next, at);
        expect(pointer2.step).toBe(1);
        // the copy's place goes on where it was, never back onto the first pastes there
        const copy3 = cascade(pointer2.next, undefined);
        expect(copy3.step).toBe(3);
        // and the pointer goes on too, after a paste at the copy's place
        expect(cascade(copy3.next, { ...at }).step).toBe(2);
    });
});

describe("cornerOf and shiftFor", () => {
    const payload = copyOf<AnyTypes>(nodes, edges, ["a", "b"]);

    it("is the least x and y of the nodes", () => {
        expect(cornerOf(copyOf<AnyTypes>(nodes, edges, ["b", "c"]))).toEqual({
            x: 200,
            y: 0,
        });
    });

    it("moves by steps from the copy's place, or puts the corner on the pointer", () => {
        expect(shiftFor(payload, 0, undefined)).toEqual({ x: 0, y: 0 });
        expect(shiftFor(payload, 2, undefined)).toEqual({
            x: 2 * OFFSET,
            y: 2 * OFFSET,
        });
        expect(shiftFor(payload, 1, { x: 100, y: -40 })).toEqual({
            x: 100 + OFFSET,
            y: -40 + OFFSET,
        });
    });
});

describe("pasted", () => {
    it("gives every node and edge a free id, joins the edges to the new nodes and moves the nodes", () => {
        const payload = copyOf<AnyTypes>(nodes, edges, ["a", "b"]);
        const taken = [...nodes, ...edges].map((entity) => entity.id);
        const copies = pasted(payload, taken, { x: 10, y: 5 });
        expect(copies.nodes.map((n) => [n.id, n.position])).toEqual([
            ["a-2", { x: 10, y: 5 }],
            ["b-2", { x: 210, y: 55 }],
        ]);
        expect(copies.edges).toEqual([
            { id: "a-b-2", source: "a-2", target: "b-2" },
        ]);
        expect(copies.nodes[0]?.data).toEqual({ label: "a" });
    });

    it("skips the numbers already taken, and pastes of copies stay on one stem", () => {
        const payload = copyOf<AnyTypes>([node("a-2", 0, 0)], [], ["a-2"]);
        expect(
            pasted(payload, ["a", "a-2", "a-3"], { x: 0, y: 0 }).nodes[0]?.id,
        ).toBe("a-4");
    });

    it("adds to a model in one batch, with the edges between the copies", () => {
        const model = createFlowModel({ version: 1, nodes, edges });
        const flow = model.get("flow-json");
        const taken = [...flow.nodes, ...flow.edges].map((entity) => entity.id);
        const copies = pasted(
            copyOf<AnyTypes>(flow.nodes, flow.edges, ["a", "b"]),
            taken,
            {
                x: OFFSET,
                y: OFFSET,
            },
        );
        const result = model.run("batch", {
            commands: [
                ...copies.nodes.map((payload) => ({
                    command: "node.add" as const,
                    payload,
                })),
                ...copies.edges.map((payload) => ({
                    command: "edge.add" as const,
                    payload,
                })),
            ],
        });
        expect(result.ok).toBe(true);
        expect(model.get("all-nodes")).toHaveLength(5);
        expect(model.get("all-edges").map((e) => e.id)).toEqual([
            "a-b",
            "b-c",
            "a-b-2",
        ]);
    });
});
