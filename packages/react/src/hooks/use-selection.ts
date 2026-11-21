import type { AnyTypes, FlowEdge, FlowNode, FlowTypes } from "@fragiola/flow";
import { useFlowContext } from "../context";
import { useFlowValue } from "./internal";

/** What is selected. */
export interface FlowSelection<T extends FlowTypes = AnyTypes> {
    readonly nodes: readonly FlowNode<T>[];
    readonly edges: readonly FlowEdge<T>[];
}

const NONE: readonly never[] = Object.freeze([]);

/**
 * The selected nodes and edges of the enclosing `Flow.Root` (`selection()`; none without it),
 * re-rendering the component when they change: a panel showing the selection, a Delete button.
 */
export function useSelection<
    T extends FlowTypes = AnyTypes,
>(): FlowSelection<T> {
    const { model } = useFlowContext("useSelection");
    return useFlowValue(
        model,
        null,
        () => ({
            nodes: (model.get("selected-nodes") ??
                NONE) as readonly FlowNode<T>[],
            edges: (model.get("selected-edges") ??
                NONE) as readonly FlowEdge<T>[],
        }),
        (a, b) =>
            a.nodes.length === b.nodes.length &&
            a.edges.length === b.edges.length &&
            a.nodes.every((node, i) => node === b.nodes[i]) &&
            a.edges.every((edge, i) => edge === b.edges[i]),
    );
}
