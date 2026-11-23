// The helper lines' geometry, framework-free: where a moving box lines up with the others. A box
// has three lines on each axis: its left, centre and right (`x`), its top, middle and bottom (`y`).
// `snapBox` moves the box by the smallest offset, per axis, that puts one of its lines on one of
// another box's lines, when that offset is within a threshold. `guidesOf` lists the lines where it
// does line up, each spanning the boxes it joins: what the example draws while a node is dragged.

export interface Point {
    readonly x: number;
    readonly y: number;
}

export interface Box {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

/**
 * A guide: `axis: "x"` is a vertical line at `x = at`, `axis: "y"` a horizontal one at `y = at`;
 * it runs from `from` to `to` along the other axis.
 */
export interface Guide {
    readonly axis: "x" | "y";
    readonly at: number;
    readonly from: number;
    readonly to: number;
}

/** Two lines closer than this line up (the rounding of a position). */
const EPSILON = 0.01;

/** A box's lines on an axis: its start, its centre and its end. */
export function linesOf(box: Box, axis: "x" | "y"): [number, number, number] {
    const start = axis === "x" ? box.x : box.y;
    const size = axis === "x" ? box.width : box.height;
    return [start, start + size / 2, start + size];
}

/**
 * The smallest offset along `axis` that puts a line of `box` on a line of one of `others`, when
 * its size is at most `threshold`; 0 when none is near enough.
 */
export function snapOffset(
    box: Box,
    others: readonly Box[],
    axis: "x" | "y",
    threshold: number,
): number {
    let best: number | undefined;
    const own = linesOf(box, axis);
    for (const other of others) {
        for (const target of linesOf(other, axis)) {
            for (const line of own) {
                const offset = target - line;
                if (
                    Math.abs(offset) <= threshold &&
                    (best === undefined || Math.abs(offset) < Math.abs(best))
                ) {
                    best = offset;
                }
            }
        }
    }
    return best ?? 0;
}

/** The box's corner moved onto the nearest lines of the others, each axis on its own. */
export function snapBox(
    box: Box,
    others: readonly Box[],
    threshold: number,
): Point {
    return {
        x: box.x + snapOffset(box, others, "x", threshold),
        y: box.y + snapOffset(box, others, "y", threshold),
    };
}

/**
 * The guides where `box` lines up with `others` now: one per line, from the farthest start to the
 * farthest end of the boxes it joins, sorted by axis then place.
 */
export function guidesOf(box: Box, others: readonly Box[]): Guide[] {
    const guides: Guide[] = [];
    for (const axis of ["x", "y"] as const) {
        const across = axis === "x" ? "y" : "x";
        const own = linesOf(box, axis);
        for (const other of others) {
            for (const line of linesOf(other, axis)) {
                if (!own.some((mine) => Math.abs(mine - line) < EPSILON)) {
                    continue;
                }
                const [ownStart, , ownEnd] = linesOf(box, across);
                const [otherStart, , otherEnd] = linesOf(other, across);
                const from = Math.min(ownStart, otherStart);
                const to = Math.max(ownEnd, otherEnd);
                const same = guides.findIndex(
                    (guide) =>
                        guide.axis === axis &&
                        Math.abs(guide.at - line) < EPSILON,
                );
                const found = guides[same];
                if (found) {
                    guides[same] = {
                        axis,
                        at: found.at,
                        from: Math.min(found.from, from),
                        to: Math.max(found.to, to),
                    };
                } else {
                    guides.push({ axis, at: line, from, to });
                }
            }
        }
    }
    return guides.sort((a, b) =>
        a.axis === b.axis ? a.at - b.at : a.axis < b.axis ? -1 : 1,
    );
}

/** Whether two lists of guides are the same (a store's `equal`: no re-render while they hold). */
export function sameGuides(a: readonly Guide[], b: readonly Guide[]): boolean {
    return (
        a.length === b.length &&
        a.every((guide, index) => {
            const other = b[index];
            return (
                other !== undefined &&
                guide.axis === other.axis &&
                guide.at === other.at &&
                guide.from === other.from &&
                guide.to === other.to
            );
        })
    );
}
