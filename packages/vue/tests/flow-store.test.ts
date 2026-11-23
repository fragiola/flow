// The root's store (Epic #61, #60 in Vue): which counters each change moves. A commit that keeps
// the lists moves the view only; a measurement moves only the records it changed; a gesture, a
// change of the lists or several render levels move every node and edge.
import { createFlowModel, type ViewChange } from "@fragiola/flow";
import { describe, expect, it } from "vitest";
import type { AnyFlowEngine, AnyFlowModel } from "../src/context";
import { createFlowStore } from "../src/utils/flow-store";
import { task } from "./flow";

function setup() {
    const model = createFlowModel({
        version: 1,
        nodes: [task("a", 0, 0), task("b", 300, 0)],
        edges: [{ id: "ab", source: "a", target: "b" }],
    }) as unknown as AnyFlowModel;
    const rects: Record<string, object> = { a: {}, b: {} };
    const paths: Record<string, object> = { ab: {} };
    let layers: readonly unknown[] = [{}];
    const listeners = new Set<(change: ViewChange) => void>();
    const engine = {
        get: (key: string, payload?: { nodeId?: string; edgeId?: string }) =>
            key === "render-layers"
                ? layers
                : key === "node-rect-by"
                  ? rects[payload?.nodeId ?? ""]
                  : paths[payload?.edgeId ?? ""],
        is: () => true,
        adapter: {
            subscribe: (listener: (change: ViewChange) => void) => {
                listeners.add(listener);
                return () => listeners.delete(listener);
            },
        },
    } as unknown as AnyFlowEngine;
    const store = createFlowStore(model);
    const notify = (change: Partial<ViewChange>) => {
        for (const listener of listeners) listener(change as ViewChange);
    };
    const counts = () => ({
        view: store.view.value,
        entity: store.entity.value,
        measure: store.measure.value,
        a: store.counterOf({ kind: "node", id: "a" }).value,
        b: store.counterOf({ kind: "node", id: "b" }).value,
        ab: store.counterOf({ kind: "edge", id: "ab" }).value,
    });
    return {
        model,
        store,
        engine,
        notify,
        counts,
        rects,
        paths,
        setLayers: (next: readonly unknown[]) => {
            layers = next;
        },
        listeners,
    };
}

describe("the flow store", () => {
    it("tells a commit that keeps the lists to the view only, one that changes them to every entity", () => {
        const { model, store, counts } = setup();
        const before = counts();
        // a commit that kept both lists (a feature's own state)
        store.commit();
        expect(counts()).toMatchObject({
            view: before.view + 1,
            entity: before.entity,
        });
        expect(
            model.run("node.move", {
                nodeId: "a",
                position: { x: 5, y: 5 },
            }).ok,
        ).toBe(true);
        store.commit();
        expect(counts()).toMatchObject({
            view: before.view + 2,
            entity: before.entity + 1,
        });
    });

    it("tells a measurement only to the records whose box or path changed", () => {
        const s = setup();
        const stops = [
            s.store.acquire({ kind: "node", id: "a" }),
            s.store.acquire({ kind: "node", id: "b" }),
            s.store.acquire({ kind: "edge", id: "ab" }),
        ];
        const stop = s.store.attach(s.engine);
        // the first measurement after the engine tells every record (its kept values dropped)
        s.notify({ measured: true });
        const before = s.counts();
        s.rects.b = {};
        s.notify({ measured: true });
        expect(s.counts()).toEqual({
            ...before,
            view: before.view + 1,
            measure: before.measure + 1,
            b: before.b + 1,
        });
        // a viewport step: the view only
        s.notify({ viewport: true } as Partial<ViewChange>);
        expect(s.counts()).toMatchObject({
            entity: before.entity,
            view: before.view + 2,
        });
        // a gesture: every entity, and the next measurement tells every record again
        s.notify({ gesture: true } as Partial<ViewChange>);
        expect(s.counts().entity).toBe(before.entity + 1);
        s.notify({ measured: true });
        expect(s.counts()).toMatchObject({
            a: before.a + 1,
            b: before.b + 2,
            ab: before.ab + 1,
        });
        // released, a record is dropped: its readers fall back to every measurement
        for (const release of stops) release();
        expect(s.store.counterOf({ kind: "node", id: "a" })).toBe(
            s.store.measure,
        );
        stop();
        expect(s.listeners.size).toBe(0);
    });

    it("tells every step to every entity while there are, or were, several render levels", () => {
        const s = setup();
        s.store.attach(s.engine);
        const before = s.counts();
        s.setLayers([{}, {}]);
        s.notify({ viewport: true } as Partial<ViewChange>);
        s.setLayers([{}]);
        s.notify({ viewport: true } as Partial<ViewChange>);
        s.notify({ viewport: true } as Partial<ViewChange>);
        expect(s.counts().entity).toBe(before.entity + 2);
        // a measurement with a viewport change too
        s.notify({ measured: true, viewport: true } as Partial<ViewChange>);
        expect(s.counts().entity).toBe(before.entity + 3);
    });
});
