// The injected contexts of the Flow primitives. The root's holds the model and the engine with the
// registry erased (`AnyTypes`, any features): a child cannot infer the root's `T` through
// injection, so the typed surface is each part's props, `useFlow<Types, typeof features>()` and
// `typedFlow<Types, typeof features>()`. The model's state never becomes reactive: the parts read
// it through the root's store (counters the root bumps on each commit and view change, by the
// readers they concern) into computed values that keep their last object while equal.
import type {
    AnyTypes,
    FlowEngine,
    FlowFeatures,
    FlowModel,
    FlowTypes,
    MinimapView,
    StaticGeometry,
} from "@fragiola/flow";
import {
    type ComputedRef,
    type InjectionKey,
    inject,
    type ShallowRef,
    type VNodeChild,
} from "vue";
import type { FlowStore } from "./utils/flow-store";

/** The model as the primitives see it: any registry, any features. */
export type AnyFlowModel = FlowModel<AnyTypes, FlowFeatures>;

/** The engine as the primitives see it: any registry, every feature's keys. */
export type AnyFlowEngine = FlowEngine<AnyTypes, FlowFeatures>;

/** The context of a `Flow.Root`. */
export interface FlowContextValue {
    readonly model: AnyFlowModel;
    /** the engine, once the root is mounted (null before, and on the server) */
    readonly engine: Readonly<ShallowRef<AnyFlowEngine | null>>;
    /** the engine as apps see it: always there, forwarding to the engine once it exists */
    readonly publicEngine: AnyFlowEngine;
    /** the root's element, once mounted: what renders outside the zoom teleports into it */
    readonly rootElement: Readonly<ShallowRef<HTMLElement | null>>;
    /** bumped on every commit of the model and every view change of the engine (`store.view`) */
    readonly revision: Readonly<ShallowRef<number>>;
    /** what the readers hear, by scope (`useFlowValue`): the root's counters */
    readonly store: FlowStore;
    /**
     * the root renders only what is in view (`onlyRenderVisible`): before the engine (which knows
     * the view) no node and no edge is rendered, rather than all of them for one render
     */
    readonly onlyRenderVisible: ComputedRef<boolean>;
    /**
     * reads the root's box once until the current patch ends (`utils/root-box.ts`): the nodes
     * layer holds it while it patches, so its new nodes' reads lay the page out once
     */
    readonly holdRootBox: () => void;
    /**
     * the flow's geometry from its document alone (`staticGeometry`, with the root's options)
     * while there is no engine (a server render, the first client render), null once it exists:
     * the parts draw from it, so the server's HTML and the first client render are the same
     */
    readonly geometry: ComputedRef<StaticGeometry | null>;
}

export const FlowKey: InjectionKey<FlowContextValue> = Symbol("Flow");

/** The node a subtree renders (`Flow.Node`): its handles, resizer and toolbar belong to it. */
export interface NodeContextValue {
    readonly nodeId: () => string;
}

export const NodeKey: InjectionKey<NodeContextValue> = Symbol("FlowNode");

/** The edge a subtree renders (`Flow.Edge`). */
export interface EdgeContextValue {
    readonly edgeId: () => string;
}

export const EdgeKey: InjectionKey<EdgeContextValue> = Symbol("FlowEdge");

/**
 * A label `Flow.EdgeLabel` (or a toolbar `Flow.EdgeToolbar`, which teleports from there into the
 * root) hands to the HTML layer of `Flow.Edges`, which renders it.
 */
export interface EdgeLabelEntry {
    /** its key among the layer's entries */
    readonly key: number | string;
    /** its edge (the outlet provides it again to the label's content) */
    readonly edgeId: () => string;
    /** renders the label's element (null: nothing yet) */
    readonly render: () => VNodeChild;
    /** bumped when the label's own attributes or slots change (they are not reactive) */
    readonly version: Readonly<ShallowRef<number>>;
}

/**
 * The HTML layer of `Flow.Edges`, where the edges' labels render: SVG holds no HTML, and a Vue
 * `Teleport` out of an SVG keeps creating SVG elements, so a label registers here instead.
 */
export interface EdgeLabelLayer {
    add(entry: EdgeLabelEntry): () => void;
}

export const EdgeLabelLayerKey: InjectionKey<EdgeLabelLayer> =
    Symbol("FlowEdgeLabelLayer");

/** The view of the enclosing `MiniMap`, for its nodes and its mask. */
export const MiniMapKey: InjectionKey<ComputedRef<MinimapView>> =
    Symbol("FlowMiniMap");

export function useFlowContext(part: string): FlowContextValue {
    const context = inject(FlowKey, null);
    if (!context) {
        throw new Error(`Flow.${part} must be rendered inside Flow.Root`);
    }
    return context;
}

/** The node of `nodeId`, or the enclosing `Flow.Node`'s, read when called. */
export function usePartNodeId(
    part: string,
    nodeId: () => string | undefined,
): () => string {
    const context = inject(NodeKey, null);
    return () => {
        const id = nodeId() ?? context?.nodeId();
        if (id === undefined) {
            throw new Error(
                `Flow.${part} must be rendered inside Flow.Node (or be given a nodeId)`,
            );
        }
        return id;
    };
}

/** The edge of `edgeId`, or the enclosing `Flow.Edge`'s, read when called. */
export function useEdgeId(
    part: string,
    edgeId: () => string | undefined,
): () => string {
    const context = inject(EdgeKey, null);
    return () => {
        const id = edgeId() ?? context?.edgeId();
        if (id === undefined) {
            throw new Error(
                `Flow.${part} must be rendered inside Flow.Edge (or be given an edgeId)`,
            );
        }
        return id;
    };
}

/** A model of any registry and features, seen erased. */
export function eraseModel<T extends FlowTypes, F extends FlowFeatures>(
    model: FlowModel<T, F>,
): AnyFlowModel {
    return model as unknown as AnyFlowModel;
}

/** The erased model seen with the registry and features the caller declares. */
export function typedModel<T extends FlowTypes, F extends FlowFeatures>(
    model: AnyFlowModel,
): FlowModel<T, F> {
    return model as unknown as FlowModel<T, F>;
}

/** The erased engine seen with the registry and features the caller declares. */
export function typedEngine<T extends FlowTypes, F extends FlowFeatures>(
    engine: AnyFlowEngine | FlowEngine,
): FlowEngine<T, F> {
    return engine as unknown as FlowEngine<T, F>;
}
