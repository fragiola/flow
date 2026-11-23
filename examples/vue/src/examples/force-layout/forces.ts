// The force layout's adapter: the document's nodes (their top-left place and declared size) become
// d3-force bodies placed by their centre, each with the radius that keeps its whole box clear of
// the others (half its diagonal, plus a margin), and its edges become links; the simulation pulls
// linked nodes together, pushes every pair apart, keeps the boxes from overlapping and holds the
// network around the origin. Its bodies go back as the `node.move` payloads the flow stores
// (top-left corners, to a tenth). A pinned body (`fx` / `fy`) stays where it is put: a dragged or
// dropped node. Framework-free: no UI library, no DOM, so every framework's example uses it unchanged.

import {
    forceCollide,
    forceLink,
    forceManyBody,
    forceSimulation,
    forceX,
    forceY,
    type Simulation,
    type SimulationLinkDatum,
    type SimulationNodeDatum,
} from "d3-force";

/** A point in flow units. */
export interface Point {
    readonly x: number;
    readonly y: number;
}

/** What the layout reads of a node: its id, its top-left place and its size. */
export interface ForceNodeInput {
    readonly id: string;
    readonly position: Point;
    readonly width: number;
    readonly height: number;
}

/** What the layout reads of an edge: its ends. */
export interface ForceEdgeInput {
    readonly source: string;
    readonly target: string;
}

/** A body of the simulation: d3 moves its centre (`x`, `y`); `fx` / `fy` pin it. */
export interface ForceNode extends SimulationNodeDatum {
    readonly id: string;
    readonly width: number;
    readonly height: number;
    /** the circle that holds its box, for the collision */
    readonly radius: number;
}

/** A link of the simulation: by ids until d3 resolves them to the bodies. */
export type ForceLink = SimulationLinkDatum<ForceNode>;

export type ForceSimulation = Simulation<ForceNode, ForceLink>;

/** How the forces are tuned. */
export interface ForceOptions {
    /** the length a link pulls towards, between the two centres */
    readonly linkDistance: number;
    /** how hard every pair pushes apart (negative: a repulsion) */
    readonly charge: number;
    /** how hard each node is pulled towards the origin, on each axis */
    readonly gravity: number;
    /** room kept between two boxes, on top of their radii */
    readonly margin: number;
    /** how fast the simulation cools (d3's default is about 0.0228: 300 ticks) */
    readonly alphaDecay: number;
}

export const FORCES: ForceOptions = {
    linkDistance: 150,
    charge: -500,
    gravity: 0.06,
    margin: 6,
    // about 170 ticks, three seconds at 60 frames a second
    alphaDecay: 0.04,
};

/** The radius of the circle around a box: half its diagonal, so two circles apart mean two boxes apart. */
export function radiusOf(width: number, height: number): number {
    return Math.hypot(width, height) / 2;
}

/** The simulation's bodies: each node by its centre, with the radius of its box. */
export function toForceNodes(nodes: readonly ForceNodeInput[]): ForceNode[] {
    return nodes.map((node) => ({
        id: node.id,
        width: node.width,
        height: node.height,
        radius: radiusOf(node.width, node.height),
        x: node.position.x + node.width / 2,
        y: node.position.y + node.height / 2,
    }));
}

/** The simulation's links: one per edge, by the ids of its ends. */
export function toForceLinks(edges: readonly ForceEdgeInput[]): ForceLink[] {
    return edges.map((edge) => ({ source: edge.source, target: edge.target }));
}

/** A coordinate to a tenth of a flow unit: what the flow stores. */
export function tenth(value: number): number {
    return Math.round(value * 10) / 10;
}

/** A body's top-left corner: its centre less half its size, to a tenth. */
export function topLeftOf(node: ForceNode): Point {
    return {
        x: tenth((node.x ?? 0) - node.width / 2),
        y: tenth((node.y ?? 0) - node.height / 2),
    };
}

/** One `node.move` payload per body, except those `skip` says (the dragged, the pinned). */
export function movesOf(
    nodes: readonly ForceNode[],
    skip: (node: ForceNode) => boolean = () => false,
): { nodeId: string; position: Point }[] {
    return nodes
        .filter((node) => !skip(node))
        .map((node) => ({ nodeId: node.id, position: topLeftOf(node) }));
}

/**
 * A simulation of `nodes` and `links`, created stopped: `tick(n)` runs it synchronously (a test),
 * `restart()` runs it on d3's timer (a tick per frame, then `end` once it has cooled).
 */
export function createSimulation(
    nodes: ForceNode[],
    links: ForceLink[],
    options: ForceOptions = FORCES,
): ForceSimulation {
    return forceSimulation<ForceNode, ForceLink>(nodes)
        .stop()
        .alphaDecay(options.alphaDecay)
        .force(
            "link",
            forceLink<ForceNode, ForceLink>(links)
                .id((node) => node.id)
                .distance(options.linkDistance),
        )
        .force("charge", forceManyBody<ForceNode>().strength(options.charge))
        .force(
            "collide",
            forceCollide<ForceNode>((node) => node.radius + options.margin / 2)
                .strength(1)
                .iterations(2),
        )
        .force("x", forceX<ForceNode>(0).strength(options.gravity))
        .force("y", forceY<ForceNode>(0).strength(options.gravity));
}

/** Pins a body with its box's top-left corner at `position`: the simulation no longer moves it. */
export function pinAt(node: ForceNode, position: Point): void {
    node.fx = position.x + node.width / 2;
    node.fy = position.y + node.height / 2;
    node.x = node.fx;
    node.y = node.fy;
}

/** Releases a body: the forces move it again, from where it is. */
export function unpin(node: ForceNode): void {
    node.fx = null;
    node.fy = null;
}

/** Whether a body is pinned. */
export function isPinned(node: ForceNode): boolean {
    return node.fx != null && node.fy != null;
}
