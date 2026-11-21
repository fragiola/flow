import type { AnyTypes, FlowEdge, FlowNode, FlowTypes } from "@fragiola/flow";
import type { ComputedRef } from "vue";
import { useFlowContext } from "../context";
import { useFlowValue } from "./internal";

/** What is selected. */
export interface FlowSelection<T extends FlowTypes = AnyTypes> {
    readonly nodes: readonly FlowNode<T>[];
    readonly edges: readonly FlowEdge<T>[];
}

const NONE: readonly never[] = Object.freeze([]);

/**
 * The selected nodes and edges of the enclosing `Flow.Root` (`selection()`; none without it), as a
 * computed ref that changes with them: a panel showing the selection, a Delete button.
 */
export function useSelection<T extends FlowTypes = AnyTypes>(): ComputedRef<
    FlowSelection<T>
> {
    const context = useFlowContext("useSelection");
    const { model } = context;
    return useFlowValue(
        context,
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
