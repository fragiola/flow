// Where a node stands, with or without an engine: its origin (the engine's `nodeOrigin`, or its own
// `origin`), its absolute position through its parents and its box (`nodeBox`), from a size lookup.
// The engine reads sizes as given, measured, then initial; the static geometry (a server render, a
// first client render) as given, then initial. One function for both, so the two agree. Pure: no
// DOM and nothing of the engine.
import type { FlowNode, XY } from "../document/types";
import type { HandleType } from "../state/queries";
import type { EdgeEndHandle } from "./edge-geometry";
import { nodeBox } from "./rect";
import type { Rect } from "./types";

/** A node's size, in flow units. */
export interface NodeSize {
    readonly width: number;
    readonly height: number;
}

/** What a node's place is computed from: the nodes by id, their sizes and the flow's origin. */
export interface NodeLayout {
    /** a node by id */
    node(nodeId: string): FlowNode | undefined;
    /** a node's size, when it is known */
    size(node: FlowNode): NodeSize | undefined;
    /** the engine's `nodeOrigin` (none: the top-left corner) */
    readonly nodeOrigin: XY | undefined;
}

const TOP_LEFT: XY = Object.freeze({ x: 0, y: 0 });
const ZERO_SIZE: NodeSize = Object.freeze({ width: 0, height: 0 });

/**
 * A node's size: per dimension, the document's `width` / `height`, else the measured one, else its
 * `initialWidth` / `initialHeight` (used only until it is measured); none while a dimension is
 * unknown.
 */
export function nodeSize(
    node: FlowNode,
    measured?: NodeSize | undefined,
): NodeSize | undefined {
    const width = node.width ?? (measured ? measured.width : node.initialWidth);
    const height =
        node.height ?? (measured ? measured.height : node.initialHeight);
    return width === undefined || height === undefined
        ? undefined
        : { width, height };
}

/**
 * The share of a node's size its position stands at: its own `origin`, else the flow's
 * `nodeOrigin`, for a node on the flow; the top-left corner for a child (its position is relative
 * to its parent's top-left corner, so the model's sub-flow rules hold as they are).
 */
export function nodeOriginOf(node: FlowNode, layout: NodeLayout): XY {
    if (node.parentId !== undefined && layout.node(node.parentId)) {
        return TOP_LEFT;
    }
    return node.origin ?? layout.nodeOrigin ?? TOP_LEFT;
}

/** A node's position in absolute flow coordinates: its parent's top-left corner plus its own. */
export function nodeAbsolutePosition(
    node: FlowNode,
    layout: NodeLayout,
    seen: Set<string> = new Set<string>(),
): XY {
    seen.add(node.id);
    const parent =
        node.parentId === undefined || seen.has(node.parentId)
            ? undefined
            : layout.node(node.parentId);
    if (!parent) return node.position;
    const corner = nodeRectOf(parent, layout, seen);
    return {
        x: corner.x + node.position.x,
        y: corner.y + node.position.y,
    };
}

/** A node's absolute box (`nodeBox`: its position at its origin), its size zero until known. */
export function nodeRectOf(
    node: FlowNode,
    layout: NodeLayout,
    seen: Set<string> = new Set<string>(),
): Rect {
    return nodeBox(
        nodeAbsolutePosition(node, layout, seen),
        layout.size(node) ?? ZERO_SIZE,
        nodeOriginOf(node, layout),
    );
}

/**
 * A node's handle of a type and id, by the engine's rule: with an id, the one of that type and id,
 * else the one of that id; without, the first of that type with no id, else the first of that type.
 */
export function matchHandle<
    H extends {
        readonly type: HandleType;
        readonly handleId: string | undefined;
    },
>(
    handles: readonly H[],
    type: HandleType,
    handleId: string | undefined,
): H | undefined {
    return handleId === undefined
        ? (handles.find(
              (handle) => handle.type === type && handle.handleId === undefined,
          ) ?? handles.find((handle) => handle.type === type))
        : (handles.find(
              (handle) => handle.type === type && handle.handleId === handleId,
          ) ?? handles.find((handle) => handle.handleId === handleId));
}

/**
 * A node's declared handle (`handles`) of a type and id, placed on its box `rect`: its centre is
 * the middle of its declared box (the point the engine measures for a rendered handle).
 */
export function declaredHandleOf(
    node: FlowNode,
    rect: Rect,
    type: HandleType,
    handleId: string | undefined,
): EdgeEndHandle | undefined {
    const declared = node.handles;
    if (!declared || declared.length === 0) return undefined;
    const found = matchHandle(
        declared.map((handle) => ({
            handle,
            type: handle.type,
            handleId: handle.id,
        })),
        type,
        handleId,
    )?.handle;
    if (!found) return undefined;
    return {
        side: found.position,
        center: {
            x: rect.x + found.x + (found.width ?? 0) / 2,
            y: rect.y + found.y + (found.height ?? 0) / 2,
        },
    };
}
