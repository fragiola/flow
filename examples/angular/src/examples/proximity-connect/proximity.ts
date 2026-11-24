// The proximity-connect example's geometry, free of any framework: how far apart two node boxes
// are, which node is the closest one within a distance, which way the new edge runs, and where the
// temporary edge is drawn. The boxes are flow rectangles (`engine.get("node-rect-by", …)`).

/** A node's box in flow coordinates. */
export interface Box {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

/** A node and its box. */
export interface Placed {
    readonly id: string;
    readonly box: Box;
}

/** An edge's ends, by node id. */
export interface Ends {
    readonly source: string;
    readonly target: string;
}

/** A proposed edge: its ends, and the two points its temporary line joins. */
export interface Link extends Ends {
    readonly from: { readonly x: number; readonly y: number };
    readonly to: { readonly x: number; readonly y: number };
}

/** The empty space between two boxes: 0 when they touch or overlap. */
export function gapBetween(a: Box, b: Box): number {
    const dx = Math.max(0, b.x - (a.x + a.width), a.x - (b.x + b.width));
    const dy = Math.max(0, b.y - (a.y + a.height), a.y - (b.y + b.height));
    return Math.hypot(dx, dy);
}

/** The candidate closest to `box`, when its gap is at most `maxGap`; the first one on a tie. */
export function closestWithin(
    box: Box,
    candidates: readonly Placed[],
    maxGap: number,
): Placed | undefined {
    let best: Placed | undefined;
    let bestGap = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
        const gap = gapBetween(box, candidate.box);
        if (gap <= maxGap && gap < bestGap) {
            best = candidate;
            bestGap = gap;
        }
    }
    return best;
}

const centreOf = (box: Box) => ({
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
});

/**
 * The edge between two nodes, read left to right: the node whose centre is further left is the
 * source (the upper one when they are aligned), and the line runs from the middle of its right
 * side to the middle of the target's left side, where their handles are.
 */
export function linkBetween(a: Placed, b: Placed): Link {
    const ca = centreOf(a.box);
    const cb = centreOf(b.box);
    const aFirst = ca.x < cb.x || (ca.x === cb.x && ca.y <= cb.y);
    const [source, target] = aFirst ? [a, b] : [b, a];
    return {
        source: source.id,
        target: target.id,
        from: {
            x: source.box.x + source.box.width,
            y: source.box.y + source.box.height / 2,
        },
        to: { x: target.box.x, y: target.box.y + target.box.height / 2 },
    };
}

/** Whether an edge already joins two nodes, either way. */
export function linked(edges: readonly Ends[], a: string, b: string): boolean {
    return edges.some(
        (edge) =>
            (edge.source === a && edge.target === b) ||
            (edge.source === b && edge.target === a),
    );
}

/**
 * The edge a dragged node would make: to the closest other node within `maxGap` that it is not
 * joined to yet, or none.
 */
export function proximityLink(
    dragged: Placed,
    others: readonly Placed[],
    edges: readonly Ends[],
    maxGap: number,
): Link | undefined {
    const closest = closestWithin(
        dragged.box,
        others.filter(
            (other) =>
                other.id !== dragged.id && !linked(edges, dragged.id, other.id),
        ),
        maxGap,
    );
    return closest ? linkBetween(dragged, closest) : undefined;
}

/** Whether two proposed edges are the same (for a store that re-renders only on a change). */
export function sameLink(a: Link | undefined, b: Link | undefined): boolean {
    if (a === undefined || b === undefined) return a === b;
    return (
        a.source === b.source &&
        a.target === b.target &&
        a.from.x === b.from.x &&
        a.from.y === b.from.y &&
        a.to.x === b.to.x &&
        a.to.y === b.to.y
    );
}
