// A floating edge: a straight line between two nodes' centres, cut where it leaves each node's
// box, so it starts and ends on their borders whichever way they face each other. Framework-free:
// the example's edge draws its own `d` from it.

export interface Point {
    readonly x: number;
    readonly y: number;
}

export interface Size {
    readonly width: number;
    readonly height: number;
}

/**
 * Where a line from a box's `center` toward `toward` crosses the box's border (a box of `size`,
 * centred on `center`); the centre itself when both points are the same.
 */
export function borderPoint(center: Point, toward: Point, size: Size): Point {
    const dx = toward.x - center.x;
    const dy = toward.y - center.y;
    if (dx === 0 && dy === 0) return center;
    // how far along the line each pair of sides is met: the nearer one is the border
    const alongX =
        dx === 0 ? Number.POSITIVE_INFINITY : size.width / 2 / Math.abs(dx);
    const alongY =
        dy === 0 ? Number.POSITIVE_INFINITY : size.height / 2 / Math.abs(dy);
    const t = Math.min(alongX, alongY);
    return { x: center.x + dx * t, y: center.y + dy * t };
}

/** The ends and the `d` of a floating edge between two boxes of `size` centred on its points. */
export function floatingLine(
    source: Point,
    target: Point,
    size: Size,
): { source: Point; target: Point; path: string } {
    const from = borderPoint(source, target, size);
    const to = borderPoint(target, source, size);
    return {
        source: from,
        target: to,
        path: `M ${from.x},${from.y} L ${to.x},${to.y}`,
    };
}
