import type { Signal } from "@angular/core";
import type { AnyTypes, FlowNode, FlowTypes } from "@fragiola/flow";
import { injectFlowContext } from "../context";
import { flowValue } from "./internal";

/**
 * Every node of the enclosing `[flowRoot]`, in drawing order, as a signal that changes on every
 * change of one. Call it in an injection context.
 */
export function injectNodes<T extends FlowTypes = AnyTypes>(): Signal<
    readonly FlowNode<T>[]
> {
    const context = injectFlowContext("injectNodes");
    return flowValue(
        context,
        () => context.model().get("all-nodes") as readonly FlowNode<T>[],
        Object.is,
    );
}
