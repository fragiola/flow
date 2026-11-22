// @vitest-environment jsdom
// The keyboard options of #32: `panOnFocus` and `beforeDelete` (a boolean, a subset, or a promise
// of either: the delete waits, then removes only what is still there), and `drag({ selectOnDrag })`.
import { afterEach, describe, expect, it } from "vitest";
import { drag } from "../../src/drag/drag";
import type { BeforeDelete, DeleteDecision } from "../../src/keyboard/keyboard";
import { keyboard } from "../../src/keyboard/keyboard";
import { selection } from "../../src/selection/selection";
import { flowOf, key, mount, pointer, unmountAll } from "../engine/harness";

afterEach(unmountAll);

const json = () =>
    flowOf(
        { a: [0, 0], b: [200, 0], c: [400, 0] },
        {
            edges: [
                { id: "ab", source: "a", target: "b" },
                { id: "bc", source: "b", target: "c" },
            ],
        },
    );
const sizes = { a: [100, 50], b: [100, 50], c: [100, 50] } as Record<
    string,
    [number, number]
>;
const ids = (list: readonly { id: string }[]) => list.map((item) => item.id);

/** A promise and its resolve, for an answer that comes later. */
function later() {
    let resolve: (value: DeleteDecision) => void = () => {};
    const promise = new Promise<DeleteDecision>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

describe("keyboard({ panOnFocus })", () => {
    it("false keeps the viewport still when a node out of view takes focus", () => {
        const flow = mount(flowOf({ far: [2000, 0] }), {
            features: [keyboard({ panOnFocus: false })],
            sizes: { far: [100, 50] },
        });
        flow.node("far").focus();
        expect(flow.engine.get("viewport")).toEqual({ x: 0, y: 0, zoom: 1 });
    });
});

describe("keyboard({ beforeDelete })", () => {
    const mounted = (beforeDelete: BeforeDelete) => {
        const flow = mount(json(), {
            features: [selection(), keyboard({ beforeDelete })],
            sizes,
        });
        flow.model.run("selection.set", { nodeIds: ["a", "b"] });
        return flow;
    };

    it("is asked with what would go (a node's edges among it); true removes it", () => {
        const asked: string[][] = [];
        const flow = mounted((nodes, edges) => {
            asked.push(ids(nodes), ids(edges));
            return true;
        });
        expect(key(flow.node("a"), "Delete").defaultPrevented).toBe(true);
        expect(asked).toEqual([
            ["a", "b"],
            ["ab", "bc"],
        ]);
        expect(ids(flow.model.get("all-nodes"))).toEqual(["c"]);
        expect(flow.events.at(-1)).toEqual({
            type: "remove",
            nodeIds: ["a", "b"],
            edgeIds: ["ab", "bc"],
        });
        // one step: an undo sees one commit
        expect(flow.commits).toHaveLength(2);
    });

    it("false keeps everything; a subset removes only that", () => {
        const keep = mounted(() => false);
        key(keep.node("a"), "Delete");
        expect(keep.model.get("all-nodes")).toHaveLength(3);
        expect(keep.events.some((e) => e.type === "remove")).toBe(false);
        unmountAll();
        const some = mounted((nodes, edges) => ({
            nodes: nodes.filter((node) => node.id === "b"),
            edges: edges.filter((edge) => edge.id === "ab"),
        }));
        key(some.node("a"), "Delete");
        expect(ids(some.model.get("all-nodes"))).toEqual(["a", "c"]);
        expect(some.model.get("all-edges")).toEqual([]);
        expect(some.events.at(-1)).toEqual({
            type: "remove",
            nodeIds: ["b"],
            edgeIds: ["ab", "bc"],
        });
    });

    it("never widens what it was asked about", () => {
        const flow = mounted((nodes) => ({
            nodes: [...nodes, { id: "c" } as never],
            edges: [],
        }));
        key(flow.node("a"), "Delete");
        expect(ids(flow.model.get("all-nodes"))).toEqual(["c"]);
    });

    it("waits for a promise, then removes what is still there", async () => {
        const answer = later();
        const flow = mounted(() => answer.promise);
        expect(key(flow.node("a"), "Delete").defaultPrevented).toBe(true);
        expect(flow.model.get("all-nodes")).toHaveLength(3);
        // another delete key while it waits is taken and does nothing
        expect(key(flow.node("a"), "Delete").defaultPrevented).toBe(true);
        // a is removed meanwhile (code, a collaborator)
        flow.model.run("node.remove", { nodeId: "a" });
        answer.resolve(true);
        await answer.promise;
        await Promise.resolve();
        expect(ids(flow.model.get("all-nodes"))).toEqual(["c"]);
        expect(flow.events.at(-1)).toEqual({
            type: "remove",
            nodeIds: ["b"],
            edgeIds: ["bc"],
        });
    });

    it("keeps everything when the promise resolves false or rejects", async () => {
        const no = later();
        const flow = mounted(() => no.promise);
        key(flow.node("a"), "Delete");
        no.resolve(false);
        await no.promise;
        await Promise.resolve();
        expect(flow.model.get("all-nodes")).toHaveLength(3);
        const failing = Promise.reject(new Error("no"));
        failing.catch(() => {});
        const rejecting = mount(json(), {
            features: [selection(), keyboard({ beforeDelete: () => failing })],
            sizes,
        });
        rejecting.model.run("selection.set", { nodeIds: ["a"] });
        key(rejecting.node("a"), "Delete");
        await failing.catch(() => {});
        await Promise.resolve();
        expect(rejecting.model.get("all-nodes")).toHaveLength(3);
        // the next key asks again
        key(rejecting.node("a"), "Delete");
    });

    it("removes nothing when the flow was locked meanwhile", async () => {
        const answer = later();
        const flow = mounted(() => answer.promise);
        key(flow.node("a"), "Delete");
        flow.engine.run("set-interactive", { interactive: false });
        answer.resolve(true);
        await answer.promise;
        await Promise.resolve();
        expect(flow.model.get("all-nodes")).toHaveLength(3);
    });

    it("removes nothing once the engine is gone", async () => {
        const answer = later();
        const flow = mounted(() => answer.promise);
        key(flow.node("a"), "Delete");
        flow.engine.destroy();
        answer.resolve(true);
        await answer.promise;
        await Promise.resolve();
        expect(flow.model.get("all-nodes")).toHaveLength(3);
    });

    it("is asked about the focused node without the selection feature", () => {
        const asked: string[] = [];
        const flow = mount(json(), {
            features: [
                keyboard({
                    beforeDelete: (nodes) => {
                        asked.push(...ids(nodes));
                        return true;
                    },
                }),
            ],
            sizes,
        });
        key(flow.node("c"), "Delete");
        expect(asked).toEqual(["c"]);
        expect(ids(flow.model.get("all-nodes"))).toEqual(["a", "b"]);
        // nothing to remove: not asked, the key is left to the page
        expect(key(flow.root, "Delete").defaultPrevented).toBe(false);
    });
});

describe("drag({ selectOnDrag })", () => {
    it("false drags an unselected node alone, the selection kept", () => {
        const flow = mount(json(), {
            features: [selection(), drag({ selectOnDrag: false })],
            sizes,
        });
        flow.model.run("selection.set", { nodeIds: ["c"] });
        pointer(flow.node("a"), "pointerdown", { clientX: 10, clientY: 10 });
        pointer(flow.root, "pointermove", { clientX: 30, clientY: 10 });
        pointer(flow.root, "pointerup", { clientX: 30, clientY: 10 });
        expect(flow.model.get("node-by", { id: "a" })?.position).toEqual({
            x: 20,
            y: 0,
        });
        expect(ids(flow.model.get("selected-nodes"))).toEqual(["c"]);
        expect(flow.model.get("node-by", { id: "c" })?.position.x).toBe(400);
    });

    it("selects the dragged node by default", () => {
        const flow = mount(json(), {
            features: [selection(), drag()],
            sizes,
        });
        pointer(flow.node("a"), "pointerdown", { clientX: 10, clientY: 10 });
        pointer(flow.root, "pointermove", { clientX: 30, clientY: 10 });
        pointer(flow.root, "pointerup", { clientX: 30, clientY: 10 });
        expect(ids(flow.model.get("selected-nodes"))).toEqual(["a"]);
    });
});
