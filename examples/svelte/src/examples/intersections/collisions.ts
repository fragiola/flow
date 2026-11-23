// The intersections example's collision resolver, free of any framework: nodes whose boxes overlap
// (or come closer than a margin) are pushed apart, along the axis where they overlap least, until
// none does. The nodes just dropped stay where they are: the others make room around them. The
// result is the new top-left corner of each node that moved, for one `batch` of `node.move`.

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

export interface ResolveOptions {
    /** the nodes that do not move (the dropped ones) */
    readonly fixed?: readonly string[];
    /** the empty space kept between two nodes, in flow units */
    readonly margin?: number;
    /** how many passes over every pair before giving up */
    readonly maxPasses?: number;
}

/** A moved node's new top-left corner. */
export interface Moved {
    readonly id: string;
    readonly position: { readonly x: number; readonly y: number };
}

/**
 * How far two boxes overlap on each axis, counting `margin` as part of the overlap; both positive
 * when they collide.
 */
export function overlapOf(a: Box, b: Box, margin = 0) {
    return {
        x: Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) + margin,
        y:
            Math.min(a.y + a.height, b.y + b.height) -
            Math.max(a.y, b.y) +
            margin,
    };
}

/** Whether two boxes overlap (or are closer than `margin`). */
export function collide(a: Box, b: Box, margin = 0): boolean {
    const overlap = overlapOf(a, b, margin);
    return overlap.x > 0 && overlap.y > 0;
}

/** Whether any two of the boxes collide. */
export function anyCollision(placed: readonly Placed[], margin = 0): boolean {
    for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
            const a = placed[i] as Placed;
            const b = placed[j] as Placed;
            if (collide(a.box, b.box, margin)) return true;
        }
    }
    return false;
}

/**
 * Pushes colliding nodes apart and returns those that moved, with their new top-left corner, in
 * the order given. The fixed nodes come first, then the others in their order; each pass goes over
 * every colliding pair and moves the later node of the two (never a fixed one) just clear of the
 * earlier, along their axis of least overlap and away from the earlier one's centre, so the push
 * spreads out from the dropped nodes. Stops when a pass finds no collision, or after `maxPasses`.
 */
export function resolveCollisions(
    placed: readonly Placed[],
    options: ResolveOptions = {},
): Moved[] {
    const fixed = new Set(options.fixed ?? []);
    const margin = options.margin ?? 0;
    const maxPasses = options.maxPasses ?? 100;
    // the fixed nodes first: a node is only ever pushed by one before it
    const order = [
        ...placed.filter((item) => fixed.has(item.id)),
        ...placed.filter((item) => !fixed.has(item.id)),
    ];
    const boxes = new Map(order.map((item) => [item.id, { ...item.box }]));
    for (let pass = 0; pass < maxPasses; pass++) {
        let moved = false;
        for (let i = 0; i < order.length; i++) {
            for (let j = i + 1; j < order.length; j++) {
                const later = order[j] as Placed;
                if (fixed.has(later.id)) continue;
                const a = boxes.get((order[i] as Placed).id) as Box;
                const b = boxes.get(later.id) as Box & { x: number; y: number };
                const overlap = overlapOf(a, b, margin);
                if (overlap.x <= 0 || overlap.y <= 0) continue;
                if (overlap.x < overlap.y) {
                    // b goes right when its centre is right of a's (or level with it)
                    b.x =
                        b.x + b.width / 2 >= a.x + a.width / 2
                            ? a.x + a.width + margin
                            : a.x - margin - b.width;
                } else {
                    b.y =
                        b.y + b.height / 2 >= a.y + a.height / 2
                            ? a.y + a.height + margin
                            : a.y - margin - b.height;
                }
                moved = true;
            }
        }
        if (!moved) break;
    }
    const result: Moved[] = [];
    for (const item of placed) {
        const box = boxes.get(item.id) as Box;
        if (box.x !== item.box.x || box.y !== item.box.y) {
            result.push({ id: item.id, position: { x: box.x, y: box.y } });
        }
    }
    return result;
}
