// The dagre layout's adapter: the document's nodes (with their declared size) and edges go into a
// dagre graph, `dagre.layout` ranks and places them in the direction asked for, and each node's
// place comes back as the top-left corner the flow stores (dagre gives a node's centre). Also the
// sides a node's handles take in each direction, so its edges leave the way the tree grows.
// Framework-free: no UI library, no DOM, so every framework's example uses it unchanged.

import dagre from "@dagrejs/dagre";

/** Which way the tree grows: down from its root, or right. */
export type Direction = "vertical" | "horizontal";

export const DIRECTIONS: readonly Direction[] = ["vertical", "horizontal"];

/** A point in flow units. */
export interface Point {
    readonly x: number;
    readonly y: number;
}

/** A side of a node, where a handle sits. */
export type Side = "top" | "right" | "bottom" | "left";

/** What the layout needs of a node: its id and its size. */
export interface LayoutNode {
    readonly id: string;
    readonly width: number;
    readonly height: number;
}

/** What the layout needs of an edge: its ends. */
export interface LayoutEdge {
    readonly source: string;
    readonly target: string;
}

/** The room between the nodes of one rank, and between the ranks, in flow units. */
export interface Spacing {
    readonly nodes: number;
    readonly ranks: number;
}

export const SPACING: Spacing = { nodes: 40, ranks: 70 };

/** dagre's name of a direction: top to bottom, or left to right. */
export const RANKDIR: Record<Direction, "TB" | "LR"> = {
    vertical: "TB",
    horizontal: "LR",
};

/** Where a node's input (target) and output (source) handles sit in each direction. */
export const HANDLE_SIDES: Record<
    Direction,
    { readonly target: Side; readonly source: Side }
> = {
    vertical: { target: "top", source: "bottom" },
    horizontal: { target: "left", source: "right" },
};

/**
 * Every node's top-left corner after dagre lays the graph out in `direction`: parents before
 * their children (above them, or to their left), no two boxes overlapping.
 */
export function layoutPositions(
    nodes: readonly LayoutNode[],
    edges: readonly LayoutEdge[],
    direction: Direction,
    spacing: Spacing = SPACING,
): Map<string, Point> {
    const graph = new dagre.graphlib.Graph();
    graph.setGraph({
        rankdir: RANKDIR[direction],
        nodesep: spacing.nodes,
        ranksep: spacing.ranks,
    });
    graph.setDefaultEdgeLabel(() => ({}));
    for (const node of nodes) {
        graph.setNode(node.id, { width: node.width, height: node.height });
    }
    for (const edge of edges) graph.setEdge(edge.source, edge.target);
    dagre.layout(graph);
    const positions = new Map<string, Point>();
    for (const node of nodes) {
        const placed = graph.node(node.id) as { x: number; y: number };
        // dagre places a node by its centre; the flow keeps its top-left corner
        positions.set(node.id, {
            x: placed.x - node.width / 2,
            y: placed.y - node.height / 2,
        });
    }
    return positions;
}
