// The layout's animation, without the clock: an easing (slow, fast, slow) and every node's place
// at a moment `t` of the way from where it was to where the layout puts it. The example asks for
// one such set of places per animation frame. Framework-free.

/** A point in flow units. */
export interface Point {
    readonly x: number;
    readonly y: number;
}

/** Ease in and out (cubic): 0 at 0, 1 at 1, ½ halfway, slow at both ends. */
export function easeInOut(t: number): number {
    const at = clamp(t);
    return at < 0.5 ? 4 * at ** 3 : 1 - (-2 * at + 2) ** 3 / 2;
}

/** `t` kept within [0, 1]. */
export function clamp(t: number): number {
    return Math.min(1, Math.max(0, t));
}

/**
 * Each node of `to` at progress `t` ∈ [0, 1] (eased by `easing`) of the way from its place in
 * `from` to its place in `to`; a node `from` lacks is already at its end.
 */
export function tween(
    from: ReadonlyMap<string, Point>,
    to: ReadonlyMap<string, Point>,
    t: number,
    easing: (t: number) => number = easeInOut,
): Map<string, Point> {
    const k = easing(clamp(t));
    const positions = new Map<string, Point>();
    for (const [id, end] of to) {
        const start = from.get(id) ?? end;
        positions.set(id, {
            x: start.x + (end.x - start.x) * k,
            y: start.y + (end.y - start.y) * k,
        });
    }
    return positions;
}
