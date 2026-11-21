import type { AnyTypes, FlowEdge, FlowTypes } from "@fragiola/flow";
import { useFlowContext } from "../context";
import { useFlowValue } from "./internal";

/** Every edge of the enclosing `Flow.Root`, in drawing order, re-rendering on every change of one. */
export function useEdges<
    T extends FlowTypes = AnyTypes,
>(): readonly FlowEdge<T>[] {
    const { model } = useFlowContext("useEdges");
    return useFlowValue(
        model,
        null,
        () => model.get("all-edges") as readonly FlowEdge<T>[],
        Object.is,
    );
}
