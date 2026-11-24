import { afterEach, describe, expect, it, vi } from "vitest";
import {
    DASH,
    DASH_PERIOD,
    describeMotion,
    onReducedMotionChange,
    prefersReducedMotion,
    REDUCED_MOTION_QUERY,
    TRAVEL_LIMITS,
    travelSeconds,
} from "../src/examples/animating-edges/motion";

// The animating-edges example's logic: the reduced-motion preference (and its changes), how long a
// dot travels an edge, the flowing dash pattern, and the words naming each animated edge.

/** A `matchMedia` whose one query list matches `matches`, and can be switched. */
function fakeMatchMedia(matches: boolean) {
    const listeners = new Set<() => void>();
    const list = {
        matches,
        media: REDUCED_MOTION_QUERY,
        addEventListener: (_: string, listener: () => void) =>
            listeners.add(listener),
        removeEventListener: (_: string, listener: () => void) =>
            listeners.delete(listener),
    };
    const matchMedia = vi.fn(() => list);
    vi.stubGlobal("window", { matchMedia });
    return {
        matchMedia,
        listeners,
        set(value: boolean) {
            list.matches = value;
            for (const listener of listeners) listener();
        },
    };
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("the reduced-motion preference", () => {
    it("is false where it cannot be known", () => {
        vi.stubGlobal("window", undefined);
        expect(prefersReducedMotion()).toBe(false);
        expect(onReducedMotionChange(() => {})).toBeTypeOf("function");
        vi.stubGlobal("window", {});
        expect(prefersReducedMotion()).toBe(false);
    });

    it("reads the media query", () => {
        const media = fakeMatchMedia(true);
        expect(prefersReducedMotion()).toBe(true);
        expect(media.matchMedia).toHaveBeenCalledWith(
            "(prefers-reduced-motion: reduce)",
        );
        media.set(false);
        expect(prefersReducedMotion()).toBe(false);
    });

    it("tells its listener when it changes, until unsubscribed", () => {
        const media = fakeMatchMedia(false);
        const listener = vi.fn();
        const unsubscribe = onReducedMotionChange(listener);
        media.set(true);
        expect(listener).toHaveBeenCalledTimes(1);
        unsubscribe();
        expect(media.listeners.size).toBe(0);
        media.set(false);
        expect(listener).toHaveBeenCalledTimes(1);
    });
});

describe("travelSeconds", () => {
    it("goes by the distance between the ends at the speed", () => {
        expect(travelSeconds({ x: 0, y: 0 }, { x: 280, y: 0 })).toBe(2);
        expect(travelSeconds({ x: 0, y: 0 }, { x: 300, y: 400 }, 250)).toBe(2);
    });

    it("keeps a trip between the limits, rounded to a tenth", () => {
        expect(travelSeconds({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(
            TRAVEL_LIMITS.min,
        );
        expect(travelSeconds({ x: 0, y: 0 }, { x: 5000, y: 0 })).toBe(
            TRAVEL_LIMITS.max,
        );
        expect(travelSeconds({ x: 0, y: 0 }, { x: 0, y: 0 }, 0)).toBe(
            TRAVEL_LIMITS.max,
        );
        expect(travelSeconds({ x: 0, y: 0 }, { x: 333, y: 0 })).toBe(2.4);
    });
});

describe("the dash", () => {
    it("loops over one whole pattern", () => {
        expect(DASH_PERIOD).toBe(DASH.dash + DASH.gap);
    });
});

describe("describeMotion", () => {
    it("names what an edge does, and that it holds still under reduced motion", () => {
        expect(describeMotion("travel", false)).toBe("a dot travels along it");
        expect(describeMotion("travel", true)).toBe(
            "a dot travels along it, still for reduced motion",
        );
        expect(describeMotion("dash", false)).toBe("dashes flow along it");
        expect(describeMotion("dash", true)).toBe(
            "dashes flow along it, still for reduced motion",
        );
        expect(describeMotion("pulse", false)).toBe(
            "pulses once when a value passes",
        );
        expect(describeMotion("pulse", true)).toBe(
            "pulses once when a value passes",
        );
    });
});
