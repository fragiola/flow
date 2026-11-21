import type { Signal } from "@angular/core";
import type { AnyTypes, FlowEdge, FlowTypes } from "@fragiola/flow";
import { injectFlowContext } from "../context";
import { flowValue } from "./internal";

/**
 * Every edge of the enclosing `[flowRoot]`, in drawing order, as a signal that changes on every
 * change of one. Call it in an injection context.
 */
export function injectEdges<T extends FlowTypes = AnyTypes>(): Signal<
    readonly FlowEdge<T>[]
> {
    const context = injectFlowContext("injectEdges");
    return flowValue(
        context,
        () => context.model().get("all-edges") as readonly FlowEdge<T>[],
        Object.is,
    );
}
