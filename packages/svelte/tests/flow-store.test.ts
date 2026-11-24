// The root's store (#54, Vue's and React's `flow-store` tests): which readers each change tells. A
// commit that keeps the lists tells the view only; a measurement tells only the records whose box
// or path it changed; a gesture, a change of the lists or several render levels tell every node
// and edge. The readers are effects reading the store's counters (`fixtures/track.svelte.ts`), as
// a `flowValue` derived does.
import { createFlowModel, type ViewChange } from "@fragiola/flow";
import { flushSync } from "svelte";
import { afterEach, describe, expect, it } from "vitest";
import type { AnyFlowEngine, AnyFlowModel } from "../src/context.js";
import {
    createFlowStore,
    type FlowEntity,
    type FlowStore,
    type FlowValueScope,
} from "../src/utils/flow-store.svelte.js";
import { type Tracker, track } from "./fixtures/track.svelte.js";
import { task } from "./flow";

const A: FlowEntity = { kind: "node", id: "a" };
const B: FlowEntity = { kind: "node", id: "b" };
const AB: FlowEntity = { kind: "edge", id: "ab" };
/** a node no reader holds a record of: it hears every measurement */
const X: FlowEntity = { kind: "node", id: "x" };

const trackers: Tracker[] = [];
afterEach(() => {
    for (const tracker of trackers.splice(0)) tracker.stop();
});

const newModel = () =>
    createFlowModel({
        version: 1,
        nodes: [task("a", 0, 0), task("b", 300, 0)],
        edges: [{ id: "ab", source: "a", target: "b" }],
    }) as unknown as AnyFlowModel;

function setup() {
    let model = newModel();
    // the engine's entity views: the same objects until a test replaces one (as the engine's)
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
    const store = createFlowStore(() => model);
    // each change flushed: the readers' effects run once per change, as the root's flush would
    const notify = (change: Partial<ViewChange>) => {
        for (const listener of listeners) listener(change as ViewChange);
        flushSync();
    };
    const commit = () => {
        store.commit();
        flushSync();
    };
    return {
        get model() {
            return model;
        },
        setModel: (next: AnyFlowModel) => {
            model = next;
        },
        store,
        engine,
        notify,
        commit,
        rects,
        paths,
        setLayers: (next: readonly unknown[]) => {
            layers = next;
        },
        listeners,
    };
}

/** A reader of `scope` (and of `entity`), stopped after the test. */
function reader(
    store: FlowStore,
    scope: FlowValueScope,
    entity?: FlowEntity,
): Tracker {
    const tracker = track(store, scope, entity);
    trackers.push(tracker);
    return tracker;
}

/** The readers of each counter: the view, every entity, a reader of x (no record), a, b, ab. */
function readers(store: FlowStore) {
    const all = {
        view: reader(store, "view"),
        entity: reader(store, "entity"),
        x: reader(store, "entity", X),
        a: reader(store, "entity", A),
        b: reader(store, "entity", B),
        ab: reader(store, "entity", AB),
    };
    let base = told();
    function told() {
        return Object.fromEntries(
            Object.entries(all).map(([name, tracker]) => [name, tracker.told]),
        ) as Record<keyof typeof all, number>;
    }
    return {
        /** what each reader was told since the last call */
        since() {
            const now = told();
            const delta = Object.fromEntries(
                Object.entries(now).map(([name, value]) => [
                    name,
                    value - base[name as keyof typeof all],
                ]),
            );
            base = now;
            return delta;
        },
    };
}

const NONE = { view: 0, entity: 0, x: 0, a: 0, b: 0, ab: 0 };
const EVERY_ENTITY = { view: 1, entity: 1, x: 1, a: 1, b: 1, ab: 1 };

describe("the flow store", () => {
    it("tells a commit that keeps the lists to the view only, one that changes them to every entity", () => {
        const s = setup();
        const told = readers(s.store);
        const view = s.store.view;
        // a commit that kept both lists (a feature's own state; the first one compares with the
        // model's lists when the store was made)
        s.commit();
        expect(told.since()).toEqual({ ...NONE, view: 1 });
        expect(
            s.model.run("node.move", {
                nodeId: "a",
                position: { x: 5, y: 5 },
            }).ok,
        ).toBe(true);
        s.commit();
        expect(told.since()).toEqual(EVERY_ENTITY);
        // an edge list changed alone counts too
        expect(s.model.run("edge.remove", { edgeId: "ab" }).ok).toBe(true);
        s.commit();
        expect(told.since()).toEqual(EVERY_ENTITY);
        // another model (the root's `model` prop): every entity, even at equal lists
        s.commit();
        told.since();
        s.setModel(newModel());
        s.commit();
        expect(told.since()).toEqual(EVERY_ENTITY);
        // `view` is the counter the context's `revision` reads
        expect(s.store.view).toBe(view + 5);
    });

    it("tells a measurement only to the records whose box or path changed", () => {
        const s = setup();
        const releases = [
            s.store.acquire(A),
            s.store.acquire(B),
            s.store.acquire(AB),
        ];
        expect(s.store.records).toBe(3);
        const told = readers(s.store);
        s.store.attach(s.engine);
        // the first measurement after the engine tells every record (its kept values dropped)
        s.notify({ measured: true });
        expect(told.since()).toEqual({
            view: 1,
            entity: 0,
            x: 1,
            a: 1,
            b: 1,
            ab: 1,
        });
        // nothing changed: the readers without a record only
        s.notify({ measured: true });
        expect(told.since()).toEqual({ ...NONE, view: 1, x: 1 });
        // b's box changed: b alone
        s.rects.b = {};
        s.notify({ measured: true });
        expect(told.since()).toEqual({ ...NONE, view: 1, x: 1, b: 1 });
        // ab's path changed: ab alone
        s.paths.ab = {};
        s.notify({ measured: true });
        expect(told.since()).toEqual({ ...NONE, view: 1, x: 1, ab: 1 });
        // a viewport step: the view only
        s.notify({ viewport: true });
        expect(told.since()).toEqual({ ...NONE, view: 1 });
        // a gesture: every entity, and the next measurement tells every record again
        s.notify({ gesture: true });
        expect(told.since()).toEqual(EVERY_ENTITY);
        s.notify({ measured: true });
        expect(told.since()).toEqual({
            view: 1,
            entity: 0,
            x: 1,
            a: 1,
            b: 1,
            ab: 1,
        });
        // a measurement with a viewport change: every entity
        s.notify({ measured: true, viewport: true });
        expect(told.since()).toEqual(EVERY_ENTITY);
        for (const release of releases) release();
    });

    it("keeps a record while it has readers, and drops it after the last one", () => {
        const s = setup();
        s.store.attach(s.engine);
        const first = s.store.acquire(A);
        const second = s.store.acquire(A);
        expect(s.store.records).toBe(1);
        first();
        // released twice: counted once
        first();
        expect(s.store.records).toBe(1);
        second();
        expect(s.store.records).toBe(0);
        // without its record, a reader of a hears every measurement
        const a = reader(s.store, "entity", A);
        s.notify({ measured: true });
        s.notify({ measured: true });
        expect(a.told).toBe(2);
    });

    it("gives a record acquired once the engine exists its box at once: an unchanged one tells nothing", () => {
        const s = setup();
        s.store.attach(s.engine);
        const release = s.store.acquire(A);
        const a = reader(s.store, "entity", A);
        s.notify({ measured: true });
        expect(a.told).toBe(0);
        s.rects.a = {};
        s.notify({ measured: true });
        expect(a.told).toBe(1);
        release();
    });

    it("tells every step to every entity while there are, or were, several render levels", () => {
        const s = setup();
        s.store.attach(s.engine);
        const entity = reader(s.store, "entity");
        s.setLayers([{}, {}]);
        s.notify({ viewport: true });
        // one level now, several at the last notification: still every entity
        s.setLayers([{}]);
        s.notify({ viewport: true });
        // one level, as at the last one: the view only
        s.notify({ viewport: true });
        expect(entity.told).toBe(2);
        // a measurement-only notification with several levels: every entity
        s.setLayers([{}, {}]);
        s.notify({ measured: true });
        expect(entity.told).toBe(3);
    });

    it("stops hearing the engine through attach's remover", () => {
        const s = setup();
        const view = reader(s.store, "view");
        const stop = s.store.attach(s.engine);
        expect(s.listeners.size).toBe(1);
        s.notify({ viewport: true });
        expect(view.told).toBe(1);
        stop();
        expect(s.listeners.size).toBe(0);
        // a later engine is heard alone
        const next = setup();
        const stopNext = s.store.attach(next.engine);
        next.notify({ viewport: true });
        expect(view.told).toBe(2);
        stopNext();
        expect(next.listeners.size).toBe(0);
    });
});
