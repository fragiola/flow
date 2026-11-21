import type { EdgeFlags, NodeFlags } from "./types";

/** A node's flag in effect: its own value, else the default (`hidden` false, the others true). */
export function nodeFlag(node: NodeFlags, flag: keyof NodeFlags): boolean {
    return node[flag] ?? flag !== "hidden";
}

/** An edge's flag in effect: its own value, else the default (`hidden` false, the others true). */
export function edgeFlag(edge: EdgeFlags, flag: keyof EdgeFlags): boolean {
    return edge[flag] ?? flag !== "hidden";
}
