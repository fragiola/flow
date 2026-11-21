import type { Signal } from "@angular/core";
import type { AnyTypes, FlowEdge, FlowNode, FlowTypes } from "@fragiola/flow";
import { injectFlowContext } from "../context";
import { flowValue } from "./internal";

/** What is selected. */
export interface FlowSelection<T extends FlowTypes = AnyTypes> {
    readonly nodes: readonly FlowNode<T>[];
    readonly edges: readonly FlowEdge<T>[];
}

const NONE: readonly never[] = Object.freeze([]);

/**
 * The selected nodes and edges of the enclosing `[flowRoot]` (`selection()`; none without it), as
 * a signal that changes with them: a panel showing the selection, a Delete button. Call it in an
 * injection context.
 */
export function injectSelection<T extends FlowTypes = AnyTypes>(): Signal<
    FlowSelection<T>
> {
    const context = injectFlowContext("injectSelection");
    return flowValue(
        context,
        () => {
            const model = context.model();
            return {
                nodes: (model.get("selected-nodes") ??
                    NONE) as readonly FlowNode<T>[],
                edges: (model.get("selected-edges") ??
                    NONE) as readonly FlowEdge<T>[],
            };
        },
        (a, b) =>
            a.nodes.length === b.nodes.length &&
            a.edges.length === b.edges.length &&
            a.nodes.every((node, i) => node === b.nodes[i]) &&
            a.edges.every((edge, i) => edge === b.edges[i]),
    );
}
