// What a root's readers hear (React's `utils/flow-store.ts`, Vue's counters, in runes): `$state`
// counters the root bumps on each change of the model and of the engine, told only to the readers
// it may concern. A `flowValue` derived reads the counter of its scope (and of its node or edge),
// so a viewport step reads no node or edge again, and a measurement only those it changed.
import type { ViewChange } from "@fragiola/flow";
import { untrack } from "svelte";
import type { AnyFlowEngine, AnyFlowModel } from "../context.js";

/**
 * @internal what a reader depends on:
 * - `view`: anything, the viewport included (the layers' lists, the background, toolbars);
 * - `entity`: one node's or edge's own view (its place, path, attributes, `z-index`), which a
 *   viewport step leaves alone, so a pan or a zoom never reads it again. A viewport step does
 *   change the nodes' `z-index` while there are several render levels (`node-z-index-by`, the
 *   levels follow the drawn edges): then it counts as an entity change too.
 */
export type FlowValueScope = "view" | "entity";

/**
 * @internal the node or the edge an `entity` reader shows: a change that is only a measurement
 * (nodes mounted, a node resized) tells it only when the measurement changed it (its node's box or
 * measured state, its edge's path), not every node and edge on screen
 */
export interface FlowEntity {
    readonly kind: "node" | "edge";
    readonly id: string;
}

/** A counter its readers depend on. */
class Counter {
    value = $state(0);
}

/** One node's or edge's readers, and what a measurement may change of it. */
interface EntityRecord {
    readonly entity: FlowEntity;
    /** bumped when a measurement changed it */
    readonly counter: Counter;
    /** its readers (`acquire`): dropped at none */
    readers: number;
    /**
     * its node's box and measured state, or its edge's path (frozen, the same until changed), as
     * of the last measurement; none after any other change (read again at the next measurement,
     * which then tells it)
     */
    token: readonly unknown[] | undefined;
}

/** @internal the counters of one root, read by its `flowValue` deriveds */
export interface FlowStore {
    /** every change: a commit of the model, every engine notification (the context's `revision`) */
    readonly view: number;
    /**
     * reads the counters a reader of `scope` depends on (in a derived): `view`, or `entity` and,
     * for a reader of one node or edge, its measurements (every measurement without a record)
     */
    track(scope: FlowValueScope, entity?: FlowEntity): void;
    /** a reader of a node or an edge: its record is kept until released */
    acquire(entity: FlowEntity): () => void;
    /** a commit of the model */
    commit(): void;
    /** the engine, once created: its notifications are told from then on; returns the remover */
    attach(engine: AnyFlowEngine): () => void;
    /** @internal the records kept (tests) */
    readonly records: number;
}

const keyOf = (entity: FlowEntity) => `${entity.kind}\u0000${entity.id}`;

/** @internal the store of a root (its model a getter: another `model` prop is followed) */
export function createFlowStore(model: () => AnyFlowModel): FlowStore {
    const view = new Counter();
    const entity = new Counter();
    const measure = new Counter();
    const records = new Map<string, EntityRecord>();
    let engine: AnyFlowEngine | null = null;

    const tokenOf = ({ kind, id }: FlowEntity): readonly unknown[] =>
        !engine
            ? []
            : kind === "node"
              ? [
                    engine.get("node-rect-by", { nodeId: id }),
                    engine.is("node-measured", { nodeId: id }),
                ]
              : [engine.get("edge-path-by", { edgeId: id })];

    /** A change: of the view only, only a measurement, or of everything. */
    const tell = (kind: "view" | "measured" | "entity") => {
        view.value++;
        if (kind === "view") return;
        if (kind === "entity") {
            for (const record of records.values()) record.token = undefined;
            entity.value++;
            return;
        }
        measure.value++;
        for (const record of records.values()) {
            const token = tokenOf(record.entity);
            const was = record.token;
            const same =
                was !== undefined &&
                token.length === was.length &&
                token.every((value, i) => Object.is(value, was[i]));
            if (same) continue;
            record.token = token;
            record.counter.value++;
        }
    };

    // a commit that keeps both lists changes no node's or edge's own view (the lists the store
    // starts from: the model's when it is made)
    const listsOf = (current: AnyFlowModel) => ({
        model: current,
        nodes: current.get("all-nodes") as unknown,
        edges: current.get("all-edges") as unknown,
    });
    let lists = untrack(() => listsOf(model()));

    return {
        get view() {
            return view.value;
        },
        get records() {
            return records.size;
        },
        track(scope, of) {
            if (scope === "view") {
                view.value;
                return;
            }
            entity.value;
            // An entity reader without an entity (handle, resizer, minimap node attributes) does
            // not re-read on a measurement, unlike React's and Vue's: none of those attributes
            // depends on one today, and re-reading them would re-render every handle on a zoom
            // (render-counts test). A feature that adds a measured attribute must track `measure`.
            if (of) (records.get(keyOf(of))?.counter ?? measure).value;
        },
        acquire(of) {
            const key = keyOf(of);
            let record = records.get(key);
            if (!record) {
                record = {
                    entity: { kind: of.kind, id: of.id },
                    counter: new Counter(),
                    readers: 0,
                    token: tokenOf(of),
                };
                records.set(key, record);
            }
            const held = record;
            held.readers += 1;
            let released = false;
            return () => {
                if (released) return;
                released = true;
                held.readers -= 1;
                if (held.readers <= 0 && records.get(key) === held) {
                    records.delete(key);
                }
            };
        },
        commit() {
            const next = listsOf(model());
            const changed =
                lists.model !== next.model ||
                lists.nodes !== next.nodes ||
                lists.edges !== next.edges;
            lists = next;
            tell(changed ? "entity" : "view");
        },
        attach(created) {
            engine = created;
            // the measurements before the engine counted nothing: read again at the next one
            for (const record of records.values()) record.token = undefined;
            // several render levels give the nodes ranks that follow the drawn edges, so the view
            const layered = () => created.get("render-layers").length > 1;
            let wasLayered = layered();
            const stop = created.adapter.subscribe((change: ViewChange) => {
                const isLayered = layered();
                const levels = isLayered || wasLayered;
                wasLayered = isLayered;
                if (change.gesture || levels) tell("entity");
                else if (change.measured)
                    tell(change.viewport ? "entity" : "measured");
                else tell("view");
            });
            return () => {
                stop();
                if (engine === created) engine = null;
            };
        },
    };
}
