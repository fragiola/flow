// What a root's readers hear (packages/react's `utils/flow-store.ts`, Vue's and Svelte's counters
// as Angular signals): counters the root bumps on each change of the model and of the engine, told
// only to the readers it may concern. A `flowValue` computed reads the counter of its scope (and
// of its node or edge), so a viewport step reads no node or edge again, and a measurement only
// those it changed.
import {
    type Signal,
    signal,
    untracked,
    type WritableSignal,
} from "@angular/core";
import type { ViewChange } from "@fragiola/flow";
import type { AnyFlowEngine, AnyFlowModel } from "../context";

/**
 * What a reader depends on:
 * - `view`: anything, the viewport included (the layers' lists, the background, toolbars);
 * - `entity`: one node's or edge's own view (its place, path, attributes, `z-index`), which a
 *   viewport step leaves alone, so a pan or a zoom never reads it again. A viewport step does
 *   change the nodes' `z-index` while there are several render levels (`node-z-index-by`, the
 *   levels follow the drawn edges): then it counts as an entity change too.
 */
export type FlowValueScope = "view" | "entity";

/**
 * The node or the edge an `entity` reader shows: a change that is only a measurement
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
    readonly counter: WritableSignal<number>;
    /** its readers (`acquire`): dropped at none */
    readers: number;
    /**
     * its node's box and measured state, or its edge's path (frozen, the same until changed), as
     * of the last measurement; none after any other change (read again at the next measurement,
     * which then tells it)
     */
    token: readonly unknown[] | undefined;
}

/** The counters of one root, read by its `flowValue` computeds */
export interface FlowStore {
    /** every change: a commit of the model, every engine notification (the context's `revision`) */
    readonly view: Signal<number>;
    /**
     * a change of every node and edge: a commit that changed the lists (or another model), a
     * gesture, a notification while there are (or were) several render levels, a measurement
     * with a viewport change
     */
    readonly entity: Signal<number>;
    /** a notification that was only a measurement: what an `entity` reader without one hears */
    readonly measure: Signal<number>;
    /**
     * the counter of a node's or an edge's measurements while it has a reader (`acquire`), else
     * `measure` (every measurement)
     */
    counterOf(entity: FlowEntity): Signal<number>;
    /** a reader of a node or an edge: its record is kept until released */
    acquire(entity: FlowEntity): () => void;
    /** a commit of `model` (another model than the last one: everything changed) */
    commit(model: AnyFlowModel): void;
    /** the engine, once created: its notifications are told from then on; returns the remover */
    attach(engine: AnyFlowEngine, notified: () => void): () => void;
}

/** @internal the key of a node's or an edge's record */
export const entityKey = (entity: FlowEntity): string =>
    `${entity.kind}\u0000${entity.id}`;

/** @internal the store of a root (its model and its engine, once attached) */
export function createFlowStore(): FlowStore {
    const view = signal(0);
    const entity = signal(0);
    const measure = signal(0);
    const records = new Map<string, EntityRecord>();
    let engine: AnyFlowEngine | null = null;

    const tokenOf = ({ kind, id }: FlowEntity): readonly unknown[] =>
        untracked(() =>
            !engine
                ? []
                : kind === "node"
                  ? [
                        engine.get("node-rect-by", { nodeId: id }),
                        engine.is("node-measured", { nodeId: id }),
                    ]
                  : [engine.get("edge-path-by", { edgeId: id })],
        );

    const bump = (counter: WritableSignal<number>) =>
        counter.update((value) => value + 1);

    /** A change: of the view only, only a measurement, or of everything. */
    const tell = (kind: "view" | "measured" | "entity") => {
        bump(view);
        if (kind === "view") return;
        if (kind === "entity") {
            for (const record of records.values()) record.token = undefined;
            bump(entity);
            return;
        }
        bump(measure);
        for (const record of records.values()) {
            const token = tokenOf(record.entity);
            const was = record.token;
            const same =
                was !== undefined &&
                token.length === was.length &&
                token.every((value, i) => Object.is(value, was[i]));
            if (same) continue;
            record.token = token;
            bump(record.counter);
        }
    };

    // a commit that keeps both lists changes no node's or edge's own view
    let last: { model: unknown; nodes: unknown; edges: unknown } = {
        model: undefined,
        nodes: undefined,
        edges: undefined,
    };

    const measured = measure.asReadonly();
    return {
        view: view.asReadonly(),
        entity: entity.asReadonly(),
        measure: measured,
        counterOf: (of) => records.get(entityKey(of))?.counter ?? measured,
        acquire(of) {
            const key = entityKey(of);
            let record = records.get(key);
            if (!record) {
                record = {
                    entity: { kind: of.kind, id: of.id },
                    counter: signal(0),
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
        commit(model) {
            const next = untracked(() => ({
                model,
                nodes: model.get("all-nodes"),
                edges: model.get("all-edges"),
            }));
            const changed =
                next.model !== last.model ||
                next.nodes !== last.nodes ||
                next.edges !== last.edges;
            last = next;
            tell(changed ? "entity" : "view");
        },
        attach(created, notified) {
            engine = created;
            // the measurements before the engine counted nothing: read again at the next one
            for (const record of records.values()) record.token = undefined;
            // several render levels give the nodes ranks that follow the drawn edges, so the view
            const layered = () =>
                untracked(() => created.get("render-layers").length > 1);
            let wasLayered = layered();
            const stop = created.adapter.subscribe((change: ViewChange) => {
                const isLayered = layered();
                const levels = isLayered || wasLayered;
                wasLayered = isLayered;
                if (change.gesture || levels) tell("entity");
                else if (change.measured)
                    tell(change.viewport ? "entity" : "measured");
                else tell("view");
                notified();
            });
            // (the readers follow the engine itself through the context's `engine` signal)
            return () => {
                stop();
                if (engine === created) engine = null;
            };
        },
    };
}
