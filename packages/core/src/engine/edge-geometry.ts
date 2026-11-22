// An edge as the engine draws it (D9): its ends at its handles' centres (or, for a node with no
// handle registered for that end, the middle of its default side: a source leaves by the bottom,
// a target enters by the top), and its path by its type.
import type { FlowEdge, XY } from "../document/types";
import { bezierPath } from "../geometry/bezier-path";
import { simpleBezierPath } from "../geometry/simple-bezier-path";
import { smoothStepPath, stepPath } from "../geometry/smooth-step-path";
import { straightPath } from "../geometry/straight-path";
import type { EdgePath, HandleSide, PathEnds, Rect } from "../geometry/types";
import type { HandleType } from "../state/queries";
import type { FlowHandle } from "./adapter";

/** The shape options of the built-in paths (the engine's `pathOptions`). */
export interface PathOptions {
    /** bezier: the share of the distance a control point stands out by; default 0.5 */
    readonly curvature?: number | undefined;
    /** smooth step: the corners' radius; default 5 */
    readonly borderRadius?: number | undefined;
    /** smooth step and step: how far an end stands out before turning; default 20 */
    readonly offset?: number | undefined;
}

/** What the edge geometry reads of the engine. */
export interface EdgeLookup {
    /** a node's absolute box, when its size is known */
    rect(nodeId: string): Rect | undefined;
    /** a node's handle of a type and id (the first of that type for none), placed */
    handle(
        nodeId: string,
        type: HandleType,
        handleId: string | undefined,
    ): FlowHandle | undefined;
}

/** The middle of a rectangle's side. */
export function sidePoint(rect: Rect, side: HandleSide): XY {
    switch (side) {
        case "top":
            return { x: rect.x + rect.width / 2, y: rect.y };
        case "right":
            return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
        case "bottom":
            return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
        case "left":
            return { x: rect.x, y: rect.y + rect.height / 2 };
    }
}

function endOf(
    lookup: EdgeLookup,
    nodeId: string,
    type: HandleType,
    handleId: string | undefined,
    fallback: HandleSide,
): { point: XY; side: HandleSide } | undefined {
    const rect = lookup.rect(nodeId);
    if (!rect) return undefined;
    const handle = lookup.handle(nodeId, type, handleId);
    if (handle?.center) return { point: handle.center, side: handle.side };
    const side = handle?.side ?? fallback;
    return { point: sidePoint(rect, side), side };
}

/** An edge's ends, once both its nodes have a size. */
export function edgeEnds(
    edge: FlowEdge,
    lookup: EdgeLookup,
): PathEnds | undefined {
    const source = endOf(
        lookup,
        edge.source,
        "source",
        edge.sourceHandle,
        "bottom",
    );
    const target = endOf(
        lookup,
        edge.target,
        "target",
        edge.targetHandle,
        "top",
    );
    return source && target
        ? {
              source: source.point,
              sourceSide: source.side,
              target: target.point,
              targetSide: target.side,
          }
        : undefined;
}

/** The path of an edge of `type` between its ends (an app's type gets the bezier). */
export function pathOf(
    type: string | undefined,
    ends: PathEnds,
    options: PathOptions,
): EdgePath {
    switch (type) {
        case "smoothstep":
            return {
                ...ends,
                ...smoothStepPath({
                    ...ends,
                    borderRadius: options.borderRadius,
                    offset: options.offset,
                }),
            };
        case "step":
            return {
                ...ends,
                ...stepPath({ ...ends, offset: options.offset }),
            };
        case "straight":
            return { ...ends, ...straightPath(ends) };
        case "simplebezier":
            return { ...ends, ...simpleBezierPath(ends) };
        default:
            return {
                ...ends,
                ...bezierPath({ ...ends, curvature: options.curvature }),
            };
    }
}
