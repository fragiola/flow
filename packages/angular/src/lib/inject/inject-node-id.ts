import { computed, type Signal } from "@angular/core";
import { injectNodeContext } from "../context";

/**
 * The id of the node the component or directive is inside (`[flowNode]`), or null outside one
 * (React's `useNodeId`): a custom node's piece reads its own node without being given its id. Call
 * it in an injection context (a constructor or a field).
 */
export function injectNodeId(): Signal<string | null> {
    const around = injectNodeContext();
    return computed(() => around?.nodeId() ?? null);
}
