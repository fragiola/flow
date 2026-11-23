// The dagre layout's adapter, top to bottom: the shown nodes (with their declared size) and the
// edges between them go into a dagre graph, `dagre.layout` ranks and places them, and each node's
// place comes back as the top-left corner the flow stores (dagre gives a node's centre). A hidden
// node is left out, and so is every edge that touches one: it gets no place and stays where it is.
// Framework-free: no UI library, no DOM, so every framework's example uses it unchanged.

import dagre from "@dagrejs/dagre";

/** A point in flow units. */
export interface Point {
    readonly x: number;
    readonly y: number;
}

/** What the layout needs of a node: its id, its size and whether it shows. */
export interface LayoutNode {
    readonly id: string;
    readonly width: number;
    readonly height: number;
    readonly hidden?: boolean;
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

export const SPACING: Spacing = { nodes: 30, ranks: 60 };

/**
 * The top-left corner of every node that is not hidden after dagre lays the tree out top to
 * bottom: parents above their children, no two boxes overlapping. Hidden nodes have no entry.
 */
export function layoutPositions(
    nodes: readonly LayoutNode[],
    edges: readonly LayoutEdge[],
    spacing: Spacing = SPACING,
): Map<string, Point> {
    const shown = nodes.filter((node) => node.hidden !== true);
    const ids = new Set(shown.map((node) => node.id));
    const graph = new dagre.graphlib.Graph();
    graph.setGraph({
        rankdir: "TB",
        nodesep: spacing.nodes,
        ranksep: spacing.ranks,
    });
    graph.setDefaultEdgeLabel(() => ({}));
    for (const node of shown) {
        graph.setNode(node.id, { width: node.width, height: node.height });
    }
    // an edge to a node dagre does not know would add that node: only edges between shown nodes
    for (const edge of edges) {
        if (ids.has(edge.source) && ids.has(edge.target)) {
            graph.setEdge(edge.source, edge.target);
        }
    }
    dagre.layout(graph);
    const positions = new Map<string, Point>();
    for (const node of shown) {
        const placed = graph.node(node.id) as { x: number; y: number };
        // dagre places a node by its centre; the flow keeps its top-left corner
        positions.set(node.id, {
            x: placed.x - node.width / 2,
            y: placed.y - node.height / 2,
        });
    }
    return positions;
}
