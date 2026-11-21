import type { AnyTypes, FlowEdge, FlowNode, FlowTypes } from "@fragiola/flow";
import { useFlowContext } from "../context.js";
import { type FlowValue, flowValue } from "./internal.svelte.js";

/** What is selected. */
export interface FlowSelection<T extends FlowTypes = AnyTypes> {
    readonly nodes: readonly FlowNode<T>[];
    readonly edges: readonly FlowEdge<T>[];
}

const NONE: readonly never[] = Object.freeze([]);

/**
 * The selected nodes and edges of the enclosing `Flow.Root` (`selection()`; none without it) as
 * `current`, which follows them: a panel showing the selection, a Delete button.
 */
export function useSelection<T extends FlowTypes = AnyTypes>(): FlowValue<
    FlowSelection<T>
> {
    const context = useFlowContext("useSelection");
    return flowValue(
        context,
        () => ({
            nodes: (context.model.get("selected-nodes") ??
                NONE) as readonly FlowNode<T>[],
            edges: (context.model.get("selected-edges") ??
                NONE) as readonly FlowEdge<T>[],
        }),
        (a, b) =>
            a.nodes.length === b.nodes.length &&
            a.edges.length === b.edges.length &&
            a.nodes.every((node, i) => node === b.nodes[i]) &&
            a.edges.every((edge, i) => edge === b.edges[i]),
    );
}
