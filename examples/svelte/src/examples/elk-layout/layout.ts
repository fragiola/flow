// The ELK layout's adapter: the document's nodes (their declared size and their input and output
// handles) become an ELK graph, each handle a port on its node's side (inputs WEST, outputs EAST,
// `FIXED_SIDE`: ELK may reorder the ports within a side to uncross the edges), each edge joining
// two ports. `new ELK().layout` places the nodes and the ports; back come every node's top-left
// corner and its handles in the order ELK put the ports in (top to bottom), so the example can
// render them in that order. Framework-free: no UI library, no DOM, so every framework's example
// uses it unchanged.

import ELK, {
    type ElkExtendedEdge,
    type ElkNode,
    type ElkPort,
    type LayoutOptions,
} from "elkjs/lib/elk.bundled.js";

/** ELK's algorithms the example offers: layers left to right, or a tree. */
export type Algorithm = "layered" | "mrtree";

export const ALGORITHMS: readonly Algorithm[] = ["layered", "mrtree"];

/** A point in flow units. */
export interface Point {
    readonly x: number;
    readonly y: number;
}

/** What the layout needs of a node: its id, its size and its handles' ids, top to bottom. */
export interface LayoutNode {
    readonly id: string;
    readonly width: number;
    readonly height: number;
    /** the input (target) handles, on the left side */
    readonly inputs: readonly string[];
    /** the output (source) handles, on the right side */
    readonly outputs: readonly string[];
}

/** What the layout needs of an edge: its ends, node and handle. */
export interface LayoutEdge {
    readonly id: string;
    readonly source: string;
    readonly target: string;
    readonly sourceHandle?: string | null | undefined;
    readonly targetHandle?: string | null | undefined;
}

/** Where ELK put a node, and its handles in the order ELK put their ports in. */
export interface Placement {
    readonly position: Point;
    readonly inputs: readonly string[];
    readonly outputs: readonly string[];
}

/** A port's box: small, ELK only needs it to space the ports along their side. */
export const PORT_SIZE = 8;

/** Every algorithm grows the graph to the right; the spacing between nodes and between layers. */
export const LAYOUT_OPTIONS: Record<Algorithm, LayoutOptions> = {
    layered: {
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.spacing.nodeNode": "40",
        "elk.layered.spacing.nodeNodeBetweenLayers": "80",
    },
    mrtree: {
        "elk.algorithm": "mrtree",
        "elk.direction": "RIGHT",
        "elk.spacing.nodeNode": "40",
    },
};

/** Which of a node's handles a port stands for: an input (target) or an output (source). */
export type PortKind = "in" | "out";

/**
 * A port's id in the ELK graph, unique across the graph: two nodes may share a handle id, and a
 * node's input and output may too (the engine tells them apart by their type).
 */
export const portId = (nodeId: string, kind: PortKind, handleId: string) =>
    `${nodeId}:${kind}:${handleId}`;

/** ELK's side of a node for each kind of port: inputs on the left, outputs on the right. */
export const SIDE: Record<PortKind, "WEST" | "EAST"> = {
    in: "WEST",
    out: "EAST",
};

function portsOf(node: LayoutNode): ElkPort[] {
    const port = (handleId: string, kind: PortKind): ElkPort => ({
        id: portId(node.id, kind, handleId),
        width: PORT_SIZE,
        height: PORT_SIZE,
        layoutOptions: { "elk.port.side": SIDE[kind] },
    });
    return [
        ...node.inputs.map((handleId) => port(handleId, "in")),
        ...node.outputs.map((handleId) => port(handleId, "out")),
    ];
}

/**
 * The ELK graph of a document: one child per node (its size, its ports), one edge per edge
 * from its source port to its target port (an edge without a handle joins the node itself).
 */
export function toElkGraph(
    nodes: readonly LayoutNode[],
    edges: readonly LayoutEdge[],
    algorithm: Algorithm,
): ElkNode {
    const end = (
        nodeId: string,
        kind: PortKind,
        handleId: string | null | undefined,
    ) => (handleId ? portId(nodeId, kind, handleId) : nodeId);
    return {
        id: "root",
        layoutOptions: LAYOUT_OPTIONS[algorithm],
        children: nodes.map((node) => ({
            id: node.id,
            width: node.width,
            height: node.height,
            layoutOptions: { "elk.portConstraints": "FIXED_SIDE" },
            ports: portsOf(node),
        })),
        edges: edges.map(
            (edge): ElkExtendedEdge => ({
                id: edge.id,
                sources: [end(edge.source, "out", edge.sourceHandle)],
                targets: [end(edge.target, "in", edge.targetHandle)],
            }),
        ),
    };
}

/** The handles of a side in the order of their ports' y (top first); the rest keep theirs. */
function orderedBy(
    handles: readonly string[],
    nodeId: string,
    kind: PortKind,
    ports: readonly ElkPort[],
): string[] {
    const y = new Map(ports.map((port) => [port.id, port.y ?? 0]));
    const yOf = (handleId: string) =>
        y.get(portId(nodeId, kind, handleId)) ?? 0;
    // a stable sort: ports ELK left level keep the document's order
    return [...handles].sort((a, b) => yOf(a) - yOf(b));
}

/** Every node's top-left corner and handle order, read from ELK's laid-out graph. */
export function fromElkGraph(
    laid: ElkNode,
    nodes: readonly LayoutNode[],
): Map<string, Placement> {
    const children = new Map(
        (laid.children ?? []).map((child) => [child.id, child]),
    );
    const placements = new Map<string, Placement>();
    for (const node of nodes) {
        const child = children.get(node.id);
        if (!child) continue;
        const ports = child.ports ?? [];
        placements.set(node.id, {
            // ELK gives a node's top-left corner, as the flow keeps it
            position: { x: child.x ?? 0, y: child.y ?? 0 },
            inputs: orderedBy(node.inputs, node.id, "in", ports),
            outputs: orderedBy(node.outputs, node.id, "out", ports),
        });
    }
    return placements;
}

/** One ELK for the page: the bundled build runs in the page's thread, no worker to start. */
let shared: InstanceType<typeof ELK> | undefined;

/** Lays the document out with `algorithm`: every node's place and its handles' order. */
export async function layoutGraph(
    nodes: readonly LayoutNode[],
    edges: readonly LayoutEdge[],
    algorithm: Algorithm,
): Promise<Map<string, Placement>> {
    shared ??= new ELK();
    const laid = await shared.layout(toElkGraph(nodes, edges, algorithm));
    return fromElkGraph(laid, nodes);
}
