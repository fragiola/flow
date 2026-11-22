// The stacking order of nodes and edges, with or without an engine: each one's stack value by the
// `zIndexMode`, the edges' drawing order, and the render layers that let an edge stand above nodes
// (`render-layers`). Pure: no DOM and nothing of the engine.
import type { FlowEdge, FlowNode } from "../document/types";

/**
 * How the stack values are worked out:
 * - `"basic"`: nodes by `zIndex` (a selected one raised with `elevateNodesOnSelect`, a child above
 *   its parent), edges by `zIndex` (a selected one raised with `elevateEdgesOnSelect`), edges
 *   always below the nodes;
 * - `"auto"` (the default): the same for nodes; an edge stands at least as high as its ends when
 *   one of them is a child, and a selected one is raised (`elevateEdgesOnSelect` defaults to true),
 *   so it may be drawn above nodes;
 * - `"manual"`: only the given `zIndex` values count.
 */
export type ZIndexMode = "basic" | "auto" | "manual";

/** The options the stack values read. */
export interface ZOrderOptions {
    /** how stack values are worked out; default `"auto"` */
    readonly zIndexMode?: ZIndexMode | undefined;
    /** a selected node, and its children with it, is raised; default true */
    readonly elevateNodesOnSelect?: boolean | undefined;
    /** a selected edge is raised; default false in `"basic"`, true in `"auto"` */
    readonly elevateEdgesOnSelect?: boolean | undefined;
}

/** What a selected node (with `elevateNodesOnSelect`) or edge (`elevateEdgesOnSelect`) is raised by. */
export const SELECTED_RAISE = 10_000;

/** A stacking value from a document's `zIndex` (anything but a finite number counts as 0). */
function zOf(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** A node's own value: its `zIndex`, raised when selected (with `elevateNodesOnSelect`). */
function ownValue(
    node: FlowNode,
    options: ZOrderOptions,
    raise: boolean,
): number {
    const raised =
        raise &&
        node.selected === true &&
        (options.elevateNodesOnSelect ?? true);
    return zOf(node.zIndex) + (raised ? SELECTED_RAISE : 0);
}

/**
 * A node's stack value: in `"manual"` its `zIndex`; otherwise its own, always above its parent's.
 * A selected node is raised, and its descendants with it; `raiseSelf: false` leaves out the node's
 * own selection raise only (its ancestors' still counts).
 */
export function nodeStackValue(
    node: FlowNode,
    nodeById: (nodeId: string) => FlowNode | undefined,
    options: ZOrderOptions,
    raiseSelf = true,
): number {
    if (options.zIndexMode === "manual") return zOf(node.zIndex);
    // most nodes have no parent: no chain to walk
    if (node.parentId === undefined) return ownValue(node, options, raiseSelf);
    const chain: FlowNode[] = [];
    const seen = new Set<string>();
    for (
        let at: FlowNode | undefined = node;
        at !== undefined && !seen.has(at.id);
        at = at.parentId === undefined ? undefined : nodeById(at.parentId)
    ) {
        seen.add(at.id);
        chain.push(at);
    }
    let z: number | undefined;
    for (const at of chain.reverse()) {
        const own = ownValue(at, options, at !== node || raiseSelf);
        z = z === undefined ? own : Math.max(own, z + 1);
    }
    return z ?? 0;
}

/**
 * An edge's stack value: in `"manual"` its `zIndex`; in `"basic"` its `zIndex`, raised when
 * selected with `elevateEdgesOnSelect` (default false); in `"auto"`, at least its ends' node values
 * (without their own selection raise, with their ancestors') when one of them is a child, raised when selected with
 * `elevateEdgesOnSelect` (default true).
 */
export function edgeStackValue(
    edge: FlowEdge,
    nodeById: (nodeId: string) => FlowNode | undefined,
    options: ZOrderOptions,
): number {
    const mode = options.zIndexMode ?? "auto";
    const own = zOf(edge.zIndex);
    if (mode === "manual") return own;
    const auto = mode === "auto";
    let value = own;
    if (auto) {
        const ends = [nodeById(edge.source), nodeById(edge.target)].filter(
            (node): node is FlowNode => node !== undefined,
        );
        const nested = ends.some(
            (node) =>
                node.parentId !== undefined &&
                nodeById(node.parentId) !== undefined,
        );
        if (nested) {
            for (const node of ends) {
                value = Math.max(
                    value,
                    nodeStackValue(node, nodeById, options, false),
                );
            }
        }
    }
    const raised =
        edge.selected === true && (options.elevateEdgesOnSelect ?? auto);
    return value + (raised ? SELECTED_RAISE : 0);
}

/** Items in drawing order: by their value, their given order among equals. */
export function drawingOrder<E>(
    items: readonly E[],
    value: (item: E) => number,
): E[] {
    return items
        .map((item, i) => ({ item, i, z: value(item) }))
        .sort((a, b) => a.z - b.z || a.i - b.i)
        .map(({ item }) => item);
}

/**
 * One level of the drawing (`render-layers`): its edges, drawn above the nodes of the levels
 * below it and below its own nodes.
 */
export interface RenderLayer {
    /** its place, 0 the lowest */
    readonly level: number;
    /**
     * the structural `z-index` of its edges' layer, in the viewport's stacking context; none with
     * a single level (today's DOM: the edges below the nodes)
     */
    readonly zIndex: number | undefined;
    /** the shown nodes of this level, in the document's order */
    readonly nodeIds: readonly string[];
    /** the edges of this level, in drawing order */
    readonly edgeIds: readonly string[];
}

/** A node or an edge with its stack value. */
export interface Stacked {
    readonly id: string;
    readonly value: number;
}

/** The render layers and, with more than one, each node's structural `z-index`. */
export interface Layering {
    readonly layers: readonly RenderLayer[];
    /** each layered node's structural `z-index`; none with a single level (its stack value is) */
    readonly zIndexes: ReadonlyMap<string, number> | undefined;
}

/**
 * Splits the shown nodes and the drawn edges (in drawing order) into levels. In `"basic"`, or when
 * no edge stands above the lowest node, one level. Otherwise each distinct edge value above the
 * lowest node value starts a level: its edges are drawn above the nodes whose value is below it,
 * and below the others (an edge at a node's value stays below it). The structural `z-index` values
 * are then ranks, negative, so what the app draws after the layers stays above them.
 */
export function renderLayers(
    nodes: readonly Stacked[],
    edges: readonly Stacked[],
    mode: ZIndexMode = "auto",
): Layering {
    const single = (): Layering => ({
        layers: Object.freeze([
            Object.freeze({
                level: 0,
                zIndex: undefined,
                nodeIds: Object.freeze(nodes.map((node) => node.id)),
                edgeIds: Object.freeze(edges.map((edge) => edge.id)),
            }),
        ]),
        zIndexes: undefined,
    });
    if (mode === "basic" || nodes.length === 0) return single();
    const lowest = nodes.reduce(
        (least, node) => Math.min(least, node.value),
        Number.POSITIVE_INFINITY,
    );
    const thresholds = [
        ...new Set(
            edges.map((edge) => edge.value).filter((value) => value > lowest),
        ),
    ].sort((a, b) => a - b);
    if (thresholds.length === 0) return single();
    const nodeLevel = (value: number) =>
        thresholds.filter((threshold) => threshold <= value).length;
    const edgeLevel = (value: number) => thresholds.indexOf(value) + 1;
    const count = thresholds.length + 1;
    const nodeIds: string[][] = Array.from({ length: count }, () => []);
    const edgeIds: string[][] = Array.from({ length: count }, () => []);
    const valuesOf: Set<number>[] = Array.from(
        { length: count },
        () => new Set<number>(),
    );
    for (const node of nodes) {
        const level = nodeLevel(node.value);
        nodeIds[level]?.push(node.id);
        valuesOf[level]?.add(node.value);
    }
    for (const edge of edges) edgeIds[edgeLevel(edge.value)]?.push(edge.id);
    // the ranks: each level's edges, then its nodes by value
    const edgeRank: number[] = [];
    const nodeRank = new Map<string, number>();
    let rank = 0;
    for (let level = 0; level < count; level++) {
        edgeRank.push(rank++);
        for (const value of [...(valuesOf[level] ?? [])].sort((a, b) => a - b))
            nodeRank.set(`${level}:${value}`, rank++);
    }
    const total = rank;
    const zIndexes = new Map<string, number>();
    for (const node of nodes) {
        const key = `${nodeLevel(node.value)}:${node.value}`;
        zIndexes.set(node.id, (nodeRank.get(key) ?? 0) - total);
    }
    return {
        layers: Object.freeze(
            Array.from({ length: count }, (_, level) =>
                Object.freeze({
                    level,
                    zIndex: (edgeRank[level] ?? 0) - total,
                    nodeIds: Object.freeze(nodeIds[level] ?? []),
                    edgeIds: Object.freeze(edgeIds[level] ?? []),
                }),
            ),
        ),
        zIndexes,
    };
}
