import {
    type AnyTypes,
    type FlowTypes,
    type InternalNode,
    sameFlowValue,
} from "@fragiola/flow";
import { useFlowContext } from "../context";
import { useFlowValue } from "./internal";

/**
 * A node as the engine knows it on screen (`internal-node-by`): the document's node, its absolute
 * position and box (`nodeOrigin` applied), whether its size is known, its z-index and its handles
 * with their centres; undefined while it does not exist or before the root is mounted. It
 * re-renders the component only when one of them changes (compared by value): a pan does not.
 */
export function useInternalNode<T extends FlowTypes = AnyTypes>(
    nodeId: string,
): InternalNode<T> | undefined {
    const { model, engine } = useFlowContext("useInternalNode");
    return useFlowValue(
        model,
        engine,
        () =>
            engine?.get("internal-node-by", { nodeId }) as
                | InternalNode<T>
                | undefined,
        sameFlowValue,
    );
}
