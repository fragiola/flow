import type { AnyTypes, FlowNode, FlowTypes } from "@fragiola/flow";
import type { ComputedRef } from "vue";
import { useFlowContext } from "../context";
import { useFlowValue } from "./internal";

/**
 * Every node of the enclosing `Flow.Root`, in drawing order, as a computed ref that changes on
 * every change of one (the model's frozen list, never made reactive).
 */
export function useNodes<T extends FlowTypes = AnyTypes>(): ComputedRef<
    readonly FlowNode<T>[]
> {
    const context = useFlowContext("useNodes");
    return useFlowValue(
        context,
        () => context.model.get("all-nodes") as readonly FlowNode<T>[],
        Object.is,
    );
}
