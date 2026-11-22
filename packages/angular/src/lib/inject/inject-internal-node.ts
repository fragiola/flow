import type { Signal } from "@angular/core";
import {
    type AnyTypes,
    type FlowTypes,
    type InternalNode,
    sameFlowValue,
} from "@fragiola/flow";
import { injectFlowContext } from "../context";
import { flowValue, type ValueOrSignal, valueNow } from "./internal";

/**
 * A node as the engine knows it on screen (`internal-node-by`, React's `useInternalNode`): the
 * document's node, its absolute position and box (`nodeOrigin` applied), whether its size is
 * known, its z-index and its handles with their centres; undefined while it does not exist or
 * before the root created its engine. The signal changes only when one of them does (compared by
 * value): a pan does not. The id is a value, a signal or a getter. Call it in an injection context
 * (a constructor or a field).
 */
export function injectInternalNode<T extends FlowTypes = AnyTypes>(
    nodeId: ValueOrSignal<string>,
): Signal<InternalNode<T> | undefined> {
    const context = injectFlowContext("injectInternalNode");
    return flowValue(
        context,
        () => {
            const engine = context.engine();
            const id = valueNow(nodeId);
            if (!engine || id === undefined) return undefined;
            return engine.get("internal-node-by", { nodeId: id }) as
                | InternalNode<T>
                | undefined;
        },
        sameFlowValue,
    );
}
