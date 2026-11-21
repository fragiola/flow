// The geometry's shapes: rectangles, handle sides, the viewport and an edge's path. Flow
// coordinates have x growing to the right and y growing down; a handle side is that physical
// direction (D8: RTL does not flip a diagram).
import type { XY } from "../document/types";

/** An axis-aligned rectangle: its top-left corner and its size. */
export interface Rect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

/** The side of a node a handle sits on, and the direction an edge leaves it in (physical, D8). */
export type HandleSide = "top" | "right" | "bottom" | "left";

/**
 * What the flow shows (D4, view state): the screen offset of the flow's origin from the root's
 * top-left corner, in pixels, and the scale. A flow point `p` is drawn at `p * zoom + (x, y)`.
 */
export interface Viewport {
    readonly x: number;
    readonly y: number;
    readonly zoom: number;
}

/** Where an edge starts and ends, and the side it leaves and enters by. */
export interface PathEnds {
    /** where it starts, in flow coordinates */
    readonly source: XY;
    /** the side of the source node it leaves by */
    readonly sourceSide: HandleSide;
    /** where it ends, in flow coordinates */
    readonly target: XY;
    /** the side of the target node it enters by */
    readonly targetSide: HandleSide;
}

/** An SVG path and the point its label goes at (halfway along it). */
export interface PathResult {
    /** the SVG path data (`d`) */
    readonly path: string;
    /** where a label goes: halfway along the path, in flow coordinates */
    readonly label: XY;
}

/** An edge as the engine draws it (`engine.get("edge-path-by", { edgeId })`). */
export interface EdgePath extends PathResult, PathEnds {}
