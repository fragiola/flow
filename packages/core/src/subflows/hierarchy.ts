// A node's place among its parents and children (sub-flows): read from `parentId`, cycle-safe
// (a document with a cycle is refused at load, but a reader never loops on one).
import type { FlowNode, XY } from "../document/types";
import type { FlowReader } from "../features/types";

/** A node's direct children, in drawing order. */
export function childrenOf(
    reader: FlowReader,
    nodeId: string,
): readonly FlowNode[] {
    return reader.nodes().filter((node) => node.parentId === nodeId);
}

/** Every node under a node (children, their children, …), in breadth-first order. */
export function descendantsOf(reader: FlowReader, nodeId: string): string[] {
    const found: string[] = [];
    const seen = new Set([nodeId]);
    for (let i = -1; i < found.length; i++) {
        const parent = i < 0 ? nodeId : (found[i] as string);
        for (const child of childrenOf(reader, parent)) {
            if (!seen.has(child.id)) {
                seen.add(child.id);
                found.push(child.id);
            }
        }
    }
    return found;
}

/** A node's position in flow coordinates: its own, plus each of its parents'. */
export function absolutePositionOf(reader: FlowReader, node: FlowNode): XY {
    let x = node.position.x;
    let y = node.position.y;
    const seen = new Set([node.id]);
    for (
        let parent =
            node.parentId === undefined
                ? undefined
                : reader.node(node.parentId);
        parent !== undefined && !seen.has(parent.id);
        parent =
            parent.parentId === undefined
                ? undefined
                : reader.node(parent.parentId)
    ) {
        seen.add(parent.id);
        x += parent.position.x;
        y += parent.position.y;
    }
    return { x, y };
}

/** Whether walking up from `nodeId` through its parents comes back to it. */
export function inCycle(reader: FlowReader, nodeId: string): boolean {
    const seen = new Set<string>();
    for (
        let id: string | undefined = reader.node(nodeId)?.parentId;
        id !== undefined;
        id = reader.node(id)?.parentId
    ) {
        if (id === nodeId) return true;
        if (seen.has(id)) return false;
        seen.add(id);
    }
    return false;
}
