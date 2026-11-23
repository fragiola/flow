// What a root's readers hear (React's `utils/flow-store.ts` in Vue's reactive way): counters that
// the root bumps on each change of the model and of the engine, told only to the readers it may
// concern. A computed of `useFlowValue` reads the counter of its scope (and of its node or edge),
// so a viewport step reads no node or edge again, and a measurement only those it changed.
import type { ViewChange } from "@fragiola/flow";
import { type ShallowRef, shallowRef } from "vue";
import type { AnyFlowEngine, AnyFlowModel } from "../context";

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

/** One node's or edge's readers, and what a measurement may change of it. */
interface EntityRecord {
    readonly entity: FlowEntity;
    /** bumped when a measurement changed it */
    readonly counter: ShallowRef<number>;
    /** its readers (`acquire`): dropped at none */
    readers: number;
    /**
     * its node's box and measured state, or its edge's path (frozen, the same until changed), as
     * of the last measurement; none after any other change (read again at the next measurement,
     * which then tells it)
     */
    token: readonly unknown[] | undefined;
}

/** @internal the counters of one root, read by its `useFlowValue` computeds */
export interface FlowStore {
    /** every change: a commit of the model, every engine notification (the root's `revision`) */
    readonly view: Readonly<ShallowRef<number>>;
    /**
     * a change of every node and edge: a commit that changed the lists, a gesture, a notification
     * while there are (or were) several render levels, a measurement with a viewport change
     */
    readonly entity: Readonly<ShallowRef<number>>;
    /** a notification that was only a measurement: what an `entity` reader without one hears */
    readonly measure: Readonly<ShallowRef<number>>;
    /**
     * the counter of a node's or an edge's measurements while it has a reader (`acquire`), else
     * `measure` (every measurement)
     */
    counterOf(entity: FlowEntity): Readonly<ShallowRef<number>>;
    /** a reader of a node or an edge: its record is kept until released */
    acquire(entity: FlowEntity): () => void;
    /** a commit of the model */
    commit(): void;
    /** the engine, once created: its notifications are told from then on; returns the remover */
    attach(engine: AnyFlowEngine): () => void;
}

const keyOf = (entity: FlowEntity) => `${entity.kind}\u0000${entity.id}`;

/** @internal the store of a root's model (and its engine, once attached) */
export function createFlowStore(model: AnyFlowModel): FlowStore {
    const view = shallowRef(0);
    const entity = shallowRef(0);
    const measure = shallowRef(0);
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

    const recordOf = (of: FlowEntity): EntityRecord => {
        const key = keyOf(of);
        let record = records.get(key);
        if (!record) {
            record = {
                entity: { kind: of.kind, id: of.id },
                counter: shallowRef(0),
                readers: 0,
                token: tokenOf(of),
            };
            records.set(key, record);
        }
        return record;
    };

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

    // a commit that keeps both lists changes no node's or edge's own view
    let nodes = model.get("all-nodes");
    let edges = model.get("all-edges");

    return {
        view,
        entity,
        measure,
        counterOf: (of) => records.get(keyOf(of))?.counter ?? measure,
        acquire(of) {
            const key = keyOf(of);
            const record = recordOf(of);
            record.readers += 1;
            let released = false;
            return () => {
                if (released) return;
                released = true;
                record.readers -= 1;
                if (record.readers <= 0 && records.get(key) === record) {
                    records.delete(key);
                }
            };
        },
        commit() {
            const nextNodes = model.get("all-nodes");
            const nextEdges = model.get("all-edges");
            const changed = nextNodes !== nodes || nextEdges !== edges;
            nodes = nextNodes;
            edges = nextEdges;
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
