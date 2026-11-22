// The contexts of the Flow primitives. The root's holds the model and the engine with the registry
// erased (`AnyTypes`, any features): a child cannot infer the root's `T` through context, so the
// typed surface is each part's props and type argument (`useFlow<Types, typeof features>()`).
import type {
    AnyTypes,
    FlowEngine,
    FlowFeatures,
    FlowModel,
    FlowTypes,
} from "@fragiola/flow";
import * as React from "react";

/** The model as the primitives see it: any registry, any features. */
export type AnyFlowModel = FlowModel<AnyTypes, FlowFeatures>;

/** The engine as the primitives see it: any registry, every feature's keys. */
export type AnyFlowEngine = FlowEngine<AnyTypes, FlowFeatures>;

/** The context of a `Flow.Root`. */
export interface FlowContextValue {
    readonly model: AnyFlowModel;
    /** the engine, once the root is mounted (null on the first render and on the server) */
    readonly engine: AnyFlowEngine | null;
    /** the engine as apps see it: always there, forwarding to the engine once it exists */
    readonly publicEngine: AnyFlowEngine;
    /** the root's element, once mounted: what renders outside the zoom portals into it */
    readonly rootElement: HTMLElement | null;
}

export const FlowContext = React.createContext<FlowContextValue | null>(null);

/** The node a subtree renders (`Flow.Node`): its handles, resizer and toolbar belong to it. */
export interface NodeContextValue {
    readonly nodeId: string;
}

export const NodeContext = React.createContext<NodeContextValue | null>(null);

/** The edge a subtree renders (`Flow.Edge`) and the HTML layer its label portals into. */
export interface EdgeContextValue {
    readonly edgeId: string;
}

export const EdgeContext = React.createContext<EdgeContextValue | null>(null);

/** The HTML layer of `Flow.Edges` that edge labels portal into (null until mounted). */
export const EdgeLabelLayerContext = React.createContext<HTMLElement | null>(
    null,
);

export function useFlowContext(part: string): FlowContextValue {
    const context = React.useContext(FlowContext);
    if (!context) {
        throw new Error(`Flow.${part} must be rendered inside Flow.Root`);
    }
    return context;
}

/** The node of `nodeId`, or the enclosing `Flow.Node`'s. */
export function usePartNodeId(part: string, nodeId?: string): string {
    const context = React.useContext(NodeContext);
    const id = nodeId ?? context?.nodeId;
    if (id === undefined) {
        throw new Error(
            `Flow.${part} must be rendered inside Flow.Node (or be given a nodeId)`,
        );
    }
    return id;
}

/** The edge of `edgeId`, or the enclosing `Flow.Edge`'s. */
export function useEdgeId(part: string, edgeId?: string): string {
    const context = React.useContext(EdgeContext);
    const id = edgeId ?? context?.edgeId;
    if (id === undefined) {
        throw new Error(
            `Flow.${part} must be rendered inside Flow.Edge (or be given an edgeId)`,
        );
    }
    return id;
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
