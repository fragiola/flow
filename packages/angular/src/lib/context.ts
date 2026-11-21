// What a `[flowRoot]` shares with its parts, and a `[flowNode]` / `[flowEdge]` with the parts
// inside it. The root's model and engine have the registry erased (`AnyTypes`, any features): a
// child cannot infer the root's `T` through injection, so the typed surface is each part's inputs
// and the template directives' contexts (`injectFlow<Types, typeof features>()`).
import { InjectionToken, inject, type Signal } from "@angular/core";
import type {
    AnyTypes,
    FlowEngine,
    FlowFeatures,
    FlowModel,
    FlowTypes,
} from "@fragiola/flow";

/** The model as the parts see it: any registry, any features. */
export type AnyFlowModel = FlowModel<AnyTypes, FlowFeatures>;

/** The engine as the parts see it: any registry, every feature's keys. */
export type AnyFlowEngine = FlowEngine<AnyTypes, FlowFeatures>;

/** The context of a `[flowRoot]`. */
export interface FlowContext {
    /** the root's model: its `model` input, or the one it created */
    readonly model: Signal<AnyFlowModel>;
    /** the engine, once the root is rendered in a browser (`null` before, and after it is destroyed) */
    readonly engine: Signal<AnyFlowEngine | null>;
    /** the engine as apps see it: always there, forwarding to the engine once it exists */
    readonly publicEngine: AnyFlowEngine;
    /** the root's element: what renders outside the zoom (a toolbar) goes into it */
    readonly rootElement: HTMLElement;
    /**
     * a number that changes on every commit of the model and every view change of the engine
     * (`engine.adapter.subscribe`): every part reads the model and the engine through it, so it
     * follows them (the model's state is never made reactive)
     */
    readonly revision: Signal<number>;
}

export const FLOW_CONTEXT = new InjectionToken<FlowContext>("Flow");

/** The node of a `[flowNode]` (or a host bound with `injectNode`), for the parts inside it. */
export interface NodeContext {
    /** its node's id (`undefined` before its input is set) */
    readonly nodeId: Signal<string | undefined>;
}

export const FLOW_NODE = new InjectionToken<NodeContext>("FlowNode");

/** The edge of a `[flowEdge]`, for the parts inside it (its path, label, reconnect anchors). */
export interface EdgeContext {
    /** its edge's id (`undefined` before its input is set) */
    readonly edgeId: Signal<string | undefined>;
}

export const FLOW_EDGE = new InjectionToken<EdgeContext>("FlowEdge");

/** The HTML layer of a `[flowEdges]`, which edge labels go into (SVG holds no HTML). */
export const FLOW_EDGE_LABEL_LAYER = new InjectionToken<HTMLElement>(
    "FlowEdgeLabelLayer",
);

/** The enclosing root's context, or a clear error outside one. */
export function injectFlowContext(part: string): FlowContext {
    const context = inject(FLOW_CONTEXT, { optional: true });
    if (!context) {
        throw new Error(`${part} must be used inside [flowRoot]`);
    }
    return context;
}

/** The enclosing node's context, if any (a part given its own `nodeId` needs none). */
export function injectNodeContext(): NodeContext | null {
    return inject(FLOW_NODE, { optional: true });
}

/** The enclosing edge's context, if any (a part given its own `edgeId` needs none). */
export function injectEdgeContext(): EdgeContext | null {
    return inject(FLOW_EDGE, { optional: true });
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
