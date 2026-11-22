import { findNodeContext } from "../context.js";

/**
 * The id of the node the component renders inside (`Flow.Node`), or null outside one: a custom
 * node's piece reads its own node without being given its id. Call it in a component's script.
 */
export function useNodeId(): string | null {
    return findNodeContext()?.nodeId ?? null;
}
