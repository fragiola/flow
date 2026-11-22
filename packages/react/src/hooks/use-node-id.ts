import * as React from "react";
import { NodeContext } from "../context";

/**
 * The id of the node the component renders inside (`Flow.Node`), or null outside one: a custom
 * node's piece reads its own node without being given its id.
 */
export function useNodeId(): string | null {
    return React.useContext(NodeContext)?.nodeId ?? null;
}
