// An edge as it is drawn (D9), with or without an engine: its ends at its handles' centres (or,
// for a node with no handle for that end, the middle of its default side: its `sourcePosition` /
// `targetPosition`, else a source leaves by the bottom and a target enters by the top), and its
// path by its type. Pure: no DOM and nothing of the engine (the server render calls it too).
import type { FlowEdge, XY } from "../document/types";
import type { HandleType } from "../state/queries";
import { bezierPath } from "./bezier-path";
import { simpleBezierPath } from "./simple-bezier-path";
import { smoothStepPath, stepPath } from "./smooth-step-path";
import { straightPath } from "./straight-path";
import type { EdgePath, HandleSide, PathEnds, Rect } from "./types";

/** The shape options of the built-in paths (the engine's `pathOptions`). */
export interface PathOptions {
    /** bezier: the share of the distance a control point stands out by; default 0.5 */
    readonly curvature?: number | undefined;
    /** smooth step: the corners' radius; default 5 */
    readonly borderRadius?: number | undefined;
    /** smooth step and step: how far an end stands out before turning; default 20 */
    readonly offset?: number | undefined;
    /** smooth step and step: where the turn sits between the source (0) and the target (1); default 0.5 */
    readonly stepPosition?: number | undefined;
    /** smooth step and step: the x of a vertical turn, in flow coordinates; default none */
    readonly centerX?: number | undefined;
    /** smooth step and step: the y of a horizontal turn, in flow coordinates; default none */
    readonly centerY?: number | undefined;
}

/** A handle as the edge geometry reads it: its side and, once placed, its absolute centre. */
export interface EdgeEndHandle {
    /** the side of its node it sits on */
    readonly side: HandleSide;
    /** its centre in absolute flow coordinates (none: the middle of its side is used) */
    readonly center: XY | undefined;
}

/** What the edge geometry reads: the engine's measured flow, or a document's declared one. */
export interface EdgeLookup {
    /** a node's absolute box, when its size is known */
    rect(nodeId: string): Rect | undefined;
    /** a node's handle of a type and id (the first of that type for none), placed */
    handle(
        nodeId: string,
        type: HandleType,
        handleId: string | undefined,
    ): EdgeEndHandle | undefined;
    /** the side an end at a node with no handle for it takes (its `sourcePosition` / `targetPosition`) */
    side(nodeId: string, type: HandleType): HandleSide | undefined;
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
): { point: XY; side: HandleSide } | undefined {
    const rect = lookup.rect(nodeId);
    if (!rect) return undefined;
    const handle = lookup.handle(nodeId, type, handleId);
    if (handle?.center) return { point: handle.center, side: handle.side };
    const side =
        handle?.side ??
        lookup.side(nodeId, type) ??
        (type === "source" ? "bottom" : "top");
    return { point: sidePoint(rect, side), side };
}

/** An edge's ends, once both its nodes have a size. */
export function edgeEnds(
    edge: FlowEdge,
    lookup: EdgeLookup,
): PathEnds | undefined {
    const source = endOf(lookup, edge.source, "source", edge.sourceHandle);
    const target = endOf(lookup, edge.target, "target", edge.targetHandle);
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
                    stepPosition: options.stepPosition,
                    centerX: options.centerX,
                    centerY: options.centerY,
                }),
            };
        case "step":
            return {
                ...ends,
                ...stepPath({
                    ...ends,
                    offset: options.offset,
                    stepPosition: options.stepPosition,
                    centerX: options.centerX,
                    centerY: options.centerY,
                }),
            };
        case "straight":
            return { ...ends, ...straightPath(ends) };
        case "simplebezier":
            return { ...ends, ...simpleBezierPath(ends) };
        default: {
            const { path, label } = bezierPath({
                ...ends,
                curvature: options.curvature,
            });
            return { ...ends, path, label };
        }
    }
}
