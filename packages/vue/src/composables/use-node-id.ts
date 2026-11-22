import { type ComputedRef, computed, inject } from "vue";
import { NodeKey } from "../context";

/**
 * The id of the node the component renders inside (`Flow.Node`), as a computed ref, or null
 * outside one: a custom node's piece reads its own node without being given its id.
 */
export function useNodeId(): ComputedRef<string | null> {
    const context = inject(NodeKey, null);
    return computed(() => context?.nodeId() ?? null);
}
