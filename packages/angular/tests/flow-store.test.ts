// The root's store (#57, Epic #58; Vue's `tests/flow-store.test.ts`): which counters a change
// bumps, and the records of the nodes and edges read, kept while read.
import { createFlowModel } from "@fragiola/flow";
import { describe, expect, it } from "vitest";
import { createFlowStore } from "../src/lib/utils/flow-store";
import { task } from "./flow";

const model = () =>
    createFlowModel({
        version: 1,
        nodes: [task("a"), task("b", 0, 200)],
        edges: [{ id: "ab", source: "a", target: "b" }],
    });

const counters = (store: ReturnType<typeof createFlowStore>) => ({
    view: store.view(),
    entity: store.entity(),
    measure: store.measure(),
});

describe("the flow store", () => {
    it("tells every node and edge a commit that changed the lists, or another model; the view alone one that kept them", () => {
        const store = createFlowStore();
        const flow = model();
        store.commit(flow);
        expect(counters(store)).toEqual({ view: 1, entity: 1, measure: 0 });
        // a selection change only: the lists are the same objects
        flow.run("node.set-data", { nodeId: "a", data: { x: 1 } });
        store.commit(flow);
        expect(counters(store)).toEqual({ view: 2, entity: 2, measure: 0 });
        store.commit(flow);
        expect(counters(store)).toEqual({ view: 3, entity: 2, measure: 0 });
        store.commit(model());
        expect(counters(store)).toEqual({ view: 4, entity: 3, measure: 0 });
    });

    it("keeps a node's or an edge's record while it is read, its counter in place of the measurements'", () => {
        const store = createFlowStore();
        const a = { kind: "node", id: "a" } as const;
        expect(store.counterOf(a)).toBe(store.measure);
        const first = store.acquire(a);
        const second = store.acquire(a);
        const record = store.counterOf(a);
        expect(record).not.toBe(store.measure);
        first();
        // released twice: once only
        first();
        expect(store.counterOf(a)).toBe(record);
        second();
        expect(store.counterOf(a)).toBe(store.measure);
    });
});
