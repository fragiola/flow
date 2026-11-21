import type { AnyTypes, FlowEdge, FlowTypes } from "@fragiola/flow";
import { useFlowContext } from "../context.js";
import { type FlowValue, flowValue } from "./internal.svelte.js";

/** Every edge of the enclosing `Flow.Root`, in drawing order, as `current`, which follows every change of one. */
export function useEdges<T extends FlowTypes = AnyTypes>(): FlowValue<
    readonly FlowEdge<T>[]
> {
    const context = useFlowContext("useEdges");
    return flowValue(
        context,
        () => context.model.get("all-edges") as readonly FlowEdge<T>[],
        Object.is,
    );
}
