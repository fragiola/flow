// One subscription to a flow's model and engine, shared by every value the primitives read
// (`useFlowValue`): each change is told once, to the readers it may concern, instead of every
// reader subscribing to both and checking the model's lists on every notification.
import type { ViewChange } from "@fragiola/flow";
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

type Listener = () => void;

/** @internal the shared subscription of one model (and engine, once there is one) */
export interface FlowStore {
    /** a number that changes whenever a value of `scope` (of `entity`) may have changed */
    readonly version: (scope: FlowValueScope, entity?: FlowEntity) => number;
    /** calls `listener` when a value of `scope` (of `entity`) may have changed; returns its remover */
    readonly subscribe: (
        scope: FlowValueScope,
        listener: Listener,
        entity?: FlowEntity,
    ) => () => void;
}

const stores = new WeakMap<object, FlowStore>();

/**
 * @internal the store of a model and its engine (the model alone before the engine), made once
 * and shared by every reader of the root. It listens to the engine from its creation on, and to
 * the model while it has a reader (catching up on the lists when it starts again, or when read
 * without one), so its versions are never stale and an unmounted root is not kept by its model.
 */
export function flowStoreOf(
    model: AnyFlowModel,
    engine: AnyFlowEngine | null,
): FlowStore {
    const key: object = engine ?? model;
    let store = stores.get(key);
    if (!store) {
        store = createFlowStore(model, engine);
        stores.set(key, store);
    }
    return store;
}

/** One node's or edge's readers, and what a measurement may change of it. */
interface EntityRecord {
    readonly entity: FlowEntity;
    readonly listeners: Set<Listener>;
    /** the stamp of its last change told by a measurement */
    stamp: number;
    /**
     * its node's box and measured state, or its edge's path (frozen, the same until changed), as
     * of the last measurement; none after any other change (read again at the next measurement,
     * which then tells it)
     */
    token: readonly unknown[] | undefined;
}

function createFlowStore(
    model: AnyFlowModel,
    engine: AnyFlowEngine | null,
): FlowStore {
    // every change takes the next stamp; a version is the stamp of the last change it covers
    let stamp = 0;
    let viewStamp = 0;
    /** the last change of every node and edge (the lists, a gesture, several levels) */
    let entityStamp = 0;
    /** the last change that was only a measurement: what every reader without an entity hears */
    let measureStamp = 0;
    const listeners: Record<FlowValueScope, Set<Listener>> = {
        view: new Set(),
        entity: new Set(),
    };
    const records = new Map<string, EntityRecord>();
    const keyOf = (entity: FlowEntity) => `${entity.kind}\u0000${entity.id}`;
    const tokenOf = ({ kind, id }: FlowEntity): readonly unknown[] =>
        !engine
            ? []
            : kind === "node"
              ? [
                    engine.get("node-rect-by", { nodeId: id }),
                    engine.is("node-measured", { nodeId: id }),
                ]
              : [engine.get("edge-path-by", { edgeId: id })];
    const call = (set: Iterable<Listener>) => {
        for (const listener of [...set]) listener();
    };

    /** A change: of the view only, only a measurement, or of everything. */
    const tell = (kind: "view" | "measured" | "entity") => {
        stamp += 1;
        viewStamp = stamp;
        call(listeners.view);
        if (kind === "view") return;
        if (kind === "entity") {
            entityStamp = stamp;
            call(listeners.entity);
            for (const record of records.values()) {
                record.token = undefined;
                call(record.listeners);
            }
            return;
        }
        measureStamp = stamp;
        call(listeners.entity);
        const changed: EntityRecord[] = [];
        for (const record of records.values()) {
            const token = tokenOf(record.entity);
            const was = record.token;
            const same =
                was !== undefined &&
                token.length === was.length &&
                token.every((value, i) => Object.is(value, was[i]));
            if (same) continue;
            record.token = token;
            record.stamp = stamp;
            changed.push(record);
        }
        for (const record of changed) call(record.listeners);
    };

    // a commit that keeps both lists changes nothing a reader reads. The store listens to the
    // model only while it has a reader, so that an unmounted root (its engine destroyed, an
    // app-owned model living on) is not kept alive by the model; when it listens again, a change
    // of the lists in between counts as a change, and so it does for a read in between.
    let nodes = model.get("all-nodes");
    let edges = model.get("all-edges");
    /** whether the lists changed since last seen, now seen */
    const listsChanged = () => {
        const nextNodes = model.get("all-nodes");
        const nextEdges = model.get("all-edges");
        if (nextNodes === nodes && nextEdges === edges) return false;
        nodes = nextNodes;
        edges = nextEdges;
        return true;
    };
    /** the model's listener's remover, while there is a reader */
    let stopModel: (() => void) | undefined;
    let readers = 0;
    /** a change of the lists seen with no one to tell: only the versions move */
    const catchUp = () => {
        if (!listsChanged()) return;
        stamp += 1;
        viewStamp = stamp;
        entityStamp = stamp;
        for (const record of records.values()) record.token = undefined;
    };
    const join = () => {
        readers += 1;
        if (stopModel) return;
        catchUp();
        stopModel = model.subscribe(() => {
            if (listsChanged()) tell("entity");
        });
    };
    const leave = () => {
        readers -= 1;
        if (readers > 0 || !stopModel) return;
        stopModel();
        stopModel = undefined;
    };

    if (engine) {
        // several render levels give the nodes ranks that follow the drawn edges, so the view
        const layered = () => engine.get("render-layers").length > 1;
        let wasLayered = layered();
        engine.adapter.subscribe((change: ViewChange) => {
            const isLayered = layered();
            const levels = isLayered || wasLayered;
            wasLayered = isLayered;
            if (change.gesture || levels) tell("entity");
            else if (change.measured)
                tell(change.viewport ? "entity" : "measured");
            else tell("view");
        });
    }

    return {
        version: (scope, entity) => {
            if (!stopModel) catchUp();
            if (scope === "view") return viewStamp;
            const record = entity ? records.get(keyOf(entity)) : undefined;
            return Math.max(entityStamp, record ? record.stamp : measureStamp);
        },
        subscribe: (scope, listener, entity) => {
            if (scope === "view" || !entity) {
                const set = listeners[scope];
                if (set.has(listener)) return () => {};
                set.add(listener);
                join();
                return () => {
                    if (set.delete(listener)) leave();
                };
            }
            const key = keyOf(entity);
            let record = records.get(key);
            if (!record) {
                // the last measurement counts as its change: a reader that read before it
                // subscribed (its render) reads again if a measurement came in between
                record = {
                    entity,
                    listeners: new Set(),
                    stamp: measureStamp,
                    token: tokenOf(entity),
                };
                records.set(key, record);
            }
            const own = record;
            if (own.listeners.has(listener)) return () => {};
            own.listeners.add(listener);
            join();
            return () => {
                if (!own.listeners.delete(listener)) return;
                if (own.listeners.size === 0 && records.get(key) === own) {
                    records.delete(key);
                }
                leave();
            };
        },
    };
}
