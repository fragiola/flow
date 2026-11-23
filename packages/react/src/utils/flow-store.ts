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

type Listener = () => void;

/** @internal the shared subscription of one model (and engine, once there is one) */
export interface FlowStore {
    /** a number that changes whenever a value of `scope` may have changed */
    readonly version: (scope: FlowValueScope) => number;
    /** calls `listener` when a value of `scope` may have changed; returns its remover */
    readonly subscribe: (
        scope: FlowValueScope,
        listener: Listener,
    ) => () => void;
}

const stores = new WeakMap<object, FlowStore>();

/**
 * @internal the store of a model and its engine (the model alone before the engine), made once
 * and shared by every reader of the root. It listens from its creation on, for as long as the
 * model (the engine) lives, so its versions are never stale.
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

function createFlowStore(
    model: AnyFlowModel,
    engine: AnyFlowEngine | null,
): FlowStore {
    let viewVersion = 0;
    let entityVersion = 0;
    const listeners: Record<FlowValueScope, Set<Listener>> = {
        view: new Set(),
        entity: new Set(),
    };
    const tell = (entity: boolean) => {
        viewVersion += 1;
        if (entity) entityVersion += 1;
        for (const listener of [...listeners.view]) listener();
        if (entity) for (const listener of [...listeners.entity]) listener();
    };

    // a commit that keeps both lists changes nothing a reader reads
    let nodes = model.get("all-nodes");
    let edges = model.get("all-edges");
    model.subscribe(() => {
        const nextNodes = model.get("all-nodes");
        const nextEdges = model.get("all-edges");
        if (nextNodes === nodes && nextEdges === edges) return;
        nodes = nextNodes;
        edges = nextEdges;
        tell(true);
    });

    if (engine) {
        // several render levels give the nodes ranks that follow the drawn edges, so the view
        const layered = () => engine.get("render-layers").length > 1;
        let wasLayered = layered();
        engine.adapter.subscribe((change: ViewChange) => {
            const isLayered = layered();
            const entity =
                change.measured || change.gesture || isLayered || wasLayered;
            wasLayered = isLayered;
            tell(entity);
        });
    }

    return {
        version: (scope) => (scope === "entity" ? entityVersion : viewVersion),
        subscribe: (scope, listener) => {
            listeners[scope].add(listener);
            return () => {
                listeners[scope].delete(listener);
            };
        },
    };
}
