import type { AnyTypes, FlowNode, FlowTypes } from "@fragiola/flow";
import { useFlowContext } from "../context.js";
import { type FlowValue, flowValue } from "./internal.svelte.js";

/** Every node of the enclosing `Flow.Root`, in drawing order, as `current`, which follows every change of one. */
export function useNodes<T extends FlowTypes = AnyTypes>(): FlowValue<
    readonly FlowNode<T>[]
> {
    const context = useFlowContext("useNodes");
    return flowValue(
        context,
        () => context.model.get("all-nodes") as readonly FlowNode<T>[],
        Object.is,
    );
}
