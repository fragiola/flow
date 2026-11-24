// The contexts of the Flow primitives. The root's holds the model and the engine with the registry
// erased (`AnyTypes`, any features): a child cannot infer the root's `T` through context, so the
// typed surface is each part's props, `useFlow<Types, typeof features>()` and
// `typedFlow<Types, typeof features>()`. Every context value is an object of getters over the
// root's `$state.raw` fields: the model's state never becomes a deep proxy (S4), and a part reads
// the model and the engine through the root's store (`utils/flow-store.svelte.ts`: counters bumped
// on the commits and the view changes that may concern it) into derived values that keep their
// last object while equal (`runes/internal.svelte.ts`).
import type {
    AnyTypes,
    FlowEngine,
    FlowFeatures,
    FlowModel,
    FlowTypes,
    StaticGeometry,
} from "@fragiola/flow";
import { getContext, hasContext, setContext } from "svelte";
import type { FlowStore } from "./utils/flow-store.svelte.js";

/** The model as the primitives see it: any registry, any features. */
export type AnyFlowModel = FlowModel<AnyTypes, FlowFeatures>;

/** The engine as the primitives see it: any registry, every feature's keys. */
export type AnyFlowEngine = FlowEngine<AnyTypes, FlowFeatures>;

/** The context of a `Flow.Root`: reactive getters. */
export interface FlowContextValue {
    /** the flow's model (another `model` prop gives another one) */
    readonly model: AnyFlowModel;
    /** the engine, once the root is mounted (null before, and on the server) */
    readonly engine: AnyFlowEngine | null;
    /** the engine as apps see it: always there, forwarding to the engine once it exists */
    readonly publicEngine: AnyFlowEngine;
    /** the root's element, once mounted: what renders outside the zoom (toolbars) goes there */
    readonly rootElement: HTMLElement | null;
    /** bumped on every commit of the model and every view change of the engine */
    readonly revision: number;
    /** what the parts read through: the root's counters, by scope (#54, React's store) */
    readonly store: FlowStore;
    /**
     * the root's `onlyRenderVisible`: a culled flow renders no node or edge before the engine (the
     * server render and the first client render)
     */
    readonly onlyRenderVisible: boolean;
    /**
     * the flow's geometry from its document alone (`staticGeometry`, the root's options) while
     * there is no engine (the server render and the first client render), null once it exists:
     * one object per document and options, so every part reads the same
     */
    readonly geometry: StaticGeometry | null;
}

const FLOW = Symbol("Flow");
const NODE = Symbol("FlowNode");
const EDGE = Symbol("FlowEdge");
const EDGE_LABEL_LAYER = Symbol("FlowEdgeLabelLayer");

/** The node a subtree renders (`Flow.Node`): its handles, resizer and toolbar belong to it. */
export interface NodeContextValue {
    readonly nodeId: string;
}

/** The edge a subtree renders (`Flow.Edge`). */
export interface EdgeContextValue {
    readonly edgeId: string;
}

/**
 * The HTML layer of `Flow.Edges` that an edge's labels render into (null until mounted): the
 * edges' element with one render level, the edge's own level wrapper with several.
 */
export interface EdgeLabelLayerValue {
    elementOf(edgeId: string): HTMLElement | null;
}

export function setFlowContext(value: FlowContextValue): void {
    setContext(FLOW, value);
}

/** The context of the enclosing `Flow.Root`, or none outside one (a rune that works without it). */
export function findFlowContext(): FlowContextValue | undefined {
    return hasContext(FLOW) ? getContext<FlowContextValue>(FLOW) : undefined;
}

export function useFlowContext(part: string): FlowContextValue {
    const context = hasContext(FLOW)
        ? getContext<FlowContextValue>(FLOW)
        : undefined;
    if (!context) {
        throw new Error(`Flow.${part} must be rendered inside Flow.Root`);
    }
    return context;
}

export function setNodeContext(value: NodeContextValue): void {
    setContext(NODE, value);
}

export function setEdgeContext(value: EdgeContextValue): void {
    setContext(EDGE, value);
}

export function setEdgeLabelLayer(value: EdgeLabelLayerValue): void {
    setContext(EDGE_LABEL_LAYER, value);
}

/** The HTML layer of the enclosing `Flow.Edges` (none outside one). */
export function useEdgeLabelLayer(): EdgeLabelLayerValue | undefined {
    return hasContext(EDGE_LABEL_LAYER)
        ? getContext<EdgeLabelLayerValue>(EDGE_LABEL_LAYER)
        : undefined;
}

/** The enclosing `Flow.Node`'s context, or none outside one. */
export function findNodeContext(): NodeContextValue | undefined {
    return hasContext(NODE) ? getContext<NodeContextValue>(NODE) : undefined;
}

/**
 * The node of `nodeId`, or the enclosing `Flow.Node`'s, read when called (`nodeId` is a getter of
 * the part's prop, so a new prop is followed).
 */
export function usePartNodeId(
    part: string,
    nodeId: () => string | undefined,
): () => string {
    const context = hasContext(NODE)
        ? getContext<NodeContextValue>(NODE)
        : undefined;
    return () => {
        const id = nodeId() ?? context?.nodeId;
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
    const context = hasContext(EDGE)
        ? getContext<EdgeContextValue>(EDGE)
        : undefined;
    return () => {
        const id = edgeId() ?? context?.edgeId;
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
