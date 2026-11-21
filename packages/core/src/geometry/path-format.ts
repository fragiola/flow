// How the path helpers write numbers and points into SVG path data: at most two decimals, never
// `-0`, so the same geometry always gives the same string.
import type { XY } from "../document/types";
import type { HandleSide } from "./types";

/** A number as path data writes it. */
export function formatNumber(value: number): string {
    const rounded = Math.round(value * 100) / 100;
    return String(Object.is(rounded, -0) ? 0 : rounded);
}

/** A point as path data writes it (`x,y`). */
export function formatPoint(point: XY): string {
    return `${formatNumber(point.x)},${formatNumber(point.y)}`;
}

/** The unit vector a side points to: an edge leaves a handle on that side in that direction. */
export function sideDirection(side: HandleSide): XY {
    switch (side) {
        case "top":
            return { x: 0, y: -1 };
        case "right":
            return { x: 1, y: 0 };
        case "bottom":
            return { x: 0, y: 1 };
        case "left":
            return { x: -1, y: 0 };
    }
}

/** The side opposite another. */
export function oppositeSide(side: HandleSide): HandleSide {
    switch (side) {
        case "top":
            return "bottom";
        case "right":
            return "left";
        case "bottom":
            return "top";
        case "left":
            return "right";
    }
}
