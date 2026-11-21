import type { AnyTypes, FlowNode, FlowTypes } from "@fragiola/flow";
import { useFlowContext } from "../context";
import { useFlowValue } from "./internal";

/** Every node of the enclosing `Flow.Root`, in drawing order, re-rendering on every change of one. */
export function useNodes<
    T extends FlowTypes = AnyTypes,
>(): readonly FlowNode<T>[] {
    const { model } = useFlowContext("useNodes");
    return useFlowValue(
        model,
        null,
        () => model.get("all-nodes") as readonly FlowNode<T>[],
        Object.is,
    );
}
