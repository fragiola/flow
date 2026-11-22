import type { EdgeFlags, NodeFlags } from "./types";

/** A node's flag in effect: its own value, else the default (`hidden` false, the others true). */
export function nodeFlag(node: NodeFlags, flag: keyof NodeFlags): boolean {
    return node[flag] ?? flag !== "hidden";
}

/**
 * An edge's flag in effect: its own value, else the default (`hidden` false, the others true);
 * `reconnectable` is true unless it is false (one end is still reconnectable).
 */
export function edgeFlag(edge: EdgeFlags, flag: keyof EdgeFlags): boolean {
    if (flag === "reconnectable") return edge.reconnectable !== false;
    return edge[flag] ?? flag !== "hidden";
}

/** Whether an edge's end may be moved (`reconnectable`: true, or that end's name). */
export function reconnectableEnd(
    edge: EdgeFlags,
    end: "source" | "target",
): boolean {
    const value = edge.reconnectable ?? true;
    return value === true || value === end;
}
