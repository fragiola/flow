// The stress test's flow, generated: a grid of nodes, each a little off its cell by a seeded
// random offset, joined into one tree (each node but the first has one edge in, from its left or
// upper neighbour), so `count` nodes have `count - 1` edges. The same size and seed always give the
// same flow, so the tests (and a reload) see the same one. Framework-free: the example and its unit
// test use it alike.

import type { DeclaredHandle, XY } from "@fragiola/flow-svelte";

/** The sizes the example offers; the first is the default. */
export const SIZES = [1_000, 5_000, 10_000, 20_000] as const;

export type Size = (typeof SIZES)[number];

/** Each node's declared box, in flow units (so a node out of view has a known size). */
export const NODE_WIDTH = 120;
export const NODE_HEIGHT = 40;
/** The grid's cell: a node's box and the room around it. */
export const CELL_X = 200;
export const CELL_Y = 100;
/** How far a node may sit off its cell's corner, either way, on each axis. */
export const JITTER_X = 30;
export const JITTER_Y = 24;

/** A node's handles, declared: an input on the left and the top, an output on the right and the bottom. */
export const HANDLES: DeclaredHandle[] = [
    {
        id: "left",
        type: "target",
        position: "left",
        x: 0,
        y: NODE_HEIGHT / 2,
    },
    { id: "top", type: "target", position: "top", x: NODE_WIDTH / 2, y: 0 },
    {
        id: "right",
        type: "source",
        position: "right",
        x: NODE_WIDTH,
        y: NODE_HEIGHT / 2,
    },
    {
        id: "bottom",
        type: "source",
        position: "bottom",
        x: NODE_WIDTH / 2,
        y: NODE_HEIGHT,
    },
];

export interface GeneratedNode {
    readonly id: string;
    readonly type: "cell";
    readonly position: XY;
    readonly width: number;
    readonly height: number;
    readonly handles: DeclaredHandle[];
    readonly data: { readonly label: string };
}

export interface GeneratedEdge {
    readonly id: string;
    readonly source: string;
    readonly target: string;
    readonly sourceHandle: "right" | "bottom";
    readonly targetHandle: "left" | "top";
}

export interface GeneratedFlow {
    readonly nodes: GeneratedNode[];
    readonly edges: GeneratedEdge[];
}

/**
 * A seeded pseudo-random generator (mulberry32): each call returns the next number in [0, 1).
 * The same seed always gives the same sequence.
 */
export function random(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
    };
}

/** A whole number in [-range, range], from the generator. */
function offset(next: () => number, range: number): number {
    return Math.floor(next() * (2 * range + 1)) - range;
}

/** How many columns a grid of `count` nodes has: about square in flow units. */
export function columnsOf(count: number): number {
    return Math.max(1, Math.ceil(Math.sqrt((count * CELL_Y) / CELL_X)));
}

/** The id of the node at `index` (0-based). */
export function nodeId(index: number): string {
    return `n${index + 1}`;
}

/** A node's name from its id: `n42` is "Node 42". */
export function labelOf(id: string): string {
    return `Node ${id.slice(1)}`;
}

/** The corner of a cell's node before its offset. */
function cellOf(index: number, columns: number): XY {
    return {
        x: (index % columns) * CELL_X,
        y: Math.floor(index / columns) * CELL_Y,
    };
}

/** A position near the cell's corner, off it by a random offset. */
function near(cell: XY, next: () => number): XY {
    return {
        x: cell.x + offset(next, JITTER_X),
        y: cell.y + offset(next, JITTER_Y),
    };
}

/** `count` nodes on a grid and the `count - 1` edges of one tree over them, from `seed`. */
export function generateFlow(count: number, seed = 1): GeneratedFlow {
    const next = random(seed);
    const columns = columnsOf(count);
    const nodes: GeneratedNode[] = [];
    const edges: GeneratedEdge[] = [];
    for (let index = 0; index < count; index += 1) {
        const id = nodeId(index);
        nodes.push({
            id,
            type: "cell",
            position: near(cellOf(index, columns), next),
            width: NODE_WIDTH,
            height: NODE_HEIGHT,
            handles: HANDLES,
            data: { label: labelOf(id) },
        });
        if (index === 0) continue;
        const column = index % columns;
        const row = Math.floor(index / columns);
        // the first column hangs from the node above, the first row from the left; the others
        // from either, at random
        const fromLeft = row === 0 || (column > 0 && next() < 0.5);
        edges.push(
            fromLeft
                ? {
                      id: `e${index + 1}`,
                      source: nodeId(index - 1),
                      target: id,
                      sourceHandle: "right",
                      targetHandle: "left",
                  }
                : {
                      id: `e${index + 1}`,
                      source: nodeId(index - columns),
                      target: id,
                      sourceHandle: "bottom",
                      targetHandle: "top",
                  },
        );
    }
    return { nodes, edges };
}

/** A node's new place: what one `node.move` of a shuffle takes. */
export interface Move {
    readonly nodeId: string;
    readonly position: XY;
}

/**
 * Every node's new place for a shuffle: a new random offset off its own cell, never where it is
 * now (so every node moves), from `seed`. `nodes` are the flow's nodes in the generated order.
 */
export function shuffle(
    nodes: readonly { readonly id: string; readonly position: XY }[],
    seed: number,
): Move[] {
    const next = random(seed);
    const columns = columnsOf(nodes.length);
    return nodes.map((node, index) => {
        const position = near(cellOf(index, columns), next);
        const same =
            position.x === node.position.x && position.y === node.position.y;
        return {
            nodeId: node.id,
            position: same ? { x: position.x + 1, y: position.y } : position,
        };
    });
}
