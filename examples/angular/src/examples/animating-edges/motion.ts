// The animating-edges example's framework-free logic: whether the user asked for reduced motion
// (and hearing when that changes), how long a dot takes to travel an edge, the dash pattern that
// flows along one, and the words that name each kind of animated edge.

/** The media query of a user who asked for less motion. */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** The query's list, or undefined where there is none (a server render, a DOM without it). */
function reducedMotionList(): MediaQueryList | undefined {
    if (
        typeof window === "undefined" ||
        typeof window.matchMedia !== "function"
    )
        return undefined;
    return window.matchMedia(REDUCED_MOTION_QUERY);
}

/** Whether the user asked for reduced motion: false where it cannot be known. */
export function prefersReducedMotion(): boolean {
    return reducedMotionList()?.matches ?? false;
}

/** Calls `listener` whenever that preference changes; returns the unsubscribe. */
export function onReducedMotionChange(listener: () => void): () => void {
    const list = reducedMotionList();
    if (!list) return () => {};
    list.addEventListener("change", listener);
    return () => list.removeEventListener("change", listener);
}

/** A point in flow coordinates. */
export interface Point {
    readonly x: number;
    readonly y: number;
}

/** The shortest and the longest trip, in seconds. */
export const TRAVEL_LIMITS = { min: 1, max: 6 } as const;

/**
 * How long a dot takes from `source` to `target` at `speed` flow pixels a second: the straight
 * distance between the ends (the path is a little longer), kept between `TRAVEL_LIMITS` and
 * rounded to a tenth, so a short edge is not a blur and a long one not a crawl.
 */
export function travelSeconds(
    source: Point,
    target: Point,
    speed = 140,
): number {
    const distance = Math.hypot(target.x - source.x, target.y - source.y);
    const seconds = speed > 0 ? distance / speed : TRAVEL_LIMITS.max;
    const kept = Math.min(
        TRAVEL_LIMITS.max,
        Math.max(TRAVEL_LIMITS.min, seconds),
    );
    return Math.round(kept * 10) / 10;
}

/** The dash pattern that flows: a dash and a gap, in flow pixels. */
export const DASH = { dash: 8, gap: 6 } as const;

/**
 * Where the dash offset starts for one loop: one whole pattern. Going from it to 0 moves the
 * dashes from the source towards the target, and the loop's end looks like its start.
 */
export const DASH_PERIOD = DASH.dash + DASH.gap;

/** What an animated edge does. */
export type Motion = "travel" | "dash" | "pulse";

/** The words naming what an edge does, and that it holds still under reduced motion. */
export function describeMotion(motion: Motion, reduced: boolean): string {
    switch (motion) {
        case "travel":
            return reduced
                ? "a dot travels along it, still for reduced motion"
                : "a dot travels along it";
        case "dash":
            return reduced
                ? "dashes flow along it, still for reduced motion"
                : "dashes flow along it";
        case "pulse":
            return "pulses once when a value passes";
    }
}
