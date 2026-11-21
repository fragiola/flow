import type { AnyTypes, FlowEdge, FlowTypes } from "@fragiola/flow";
import type { ComputedRef } from "vue";
import { useFlowContext } from "../context";
import { useFlowValue } from "./internal";

/**
 * Every edge of the enclosing `Flow.Root`, in drawing order, as a computed ref that changes on
 * every change of one (the model's frozen list, never made reactive).
 */
export function useEdges<T extends FlowTypes = AnyTypes>(): ComputedRef<
    readonly FlowEdge<T>[]
> {
    const context = useFlowContext("useEdges");
    return useFlowValue(
        context,
        () => context.model.get("all-edges") as readonly FlowEdge<T>[],
        Object.is,
    );
}
