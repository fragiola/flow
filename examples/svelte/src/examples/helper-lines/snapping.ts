import type {
    AnyTypes,
    FlowFeatures,
    FlowTypes,
    Middleware,
    XY,
} from "@fragiola/flow-svelte";
import { type Box, snapBox } from "./alignment";

// The snap, as a middleware: a drag moves a node by `node.move` steps run as `transient`, then
// once more for the drop. The middleware rewrites the position of each of them so the node's
// edges or centre land on another node's when they are within `threshold` (flow units): the
// steps snap while the pointer moves, and the drop lands where the last step showed it. A move
// that is no drag's (a key, code) is left as it is; so is the move that puts the node back where
// the drag began (Escape cancels a drag). A selection dragged together moves in a `batch`: it is
// not snapped.

/** What the snap reads of a node: its id, place and size in the document. */
export interface Sized {
    readonly id: string;
    readonly position: XY;
    readonly width?: number;
    readonly height?: number;
    readonly initialWidth?: number;
    readonly initialHeight?: number;
    readonly parentId?: string;
    readonly hidden?: boolean;
}

/** A node's box in the document: its position and the size the document gives it. */
export function boxOf(node: Sized): Box {
    return {
        x: node.position.x,
        y: node.position.y,
        width: node.width ?? node.initialWidth ?? 0,
        height: node.height ?? node.initialHeight ?? 0,
    };
}

/** The boxes a node lines up with: the other top-level nodes', with a size. */
export function othersOf(nodes: readonly Sized[], nodeId: string): Box[] {
    return nodes
        .filter(
            (node) =>
                node.id !== nodeId &&
                node.parentId === undefined &&
                node.hidden !== true,
        )
        .map(boxOf)
        .filter((box) => box.width > 0 && box.height > 0);
}

/**
 * The middleware that snaps a dragged node onto the lines of the others, for a model of any
 * registry and features (`node.move` is the core's).
 */
export function snapToLines<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = FlowFeatures,
>(threshold: number): Middleware<T, F> {
    // the node a drag is moving, and where it began
    let drag: { nodeId: string; from: XY } | undefined;
    return (ctx, next) => {
        if (ctx.command !== "node.move" || ctx.dryRun || ctx.inBatch) {
            return next();
        }
        // a generic context does not narrow: `node.move`'s payload, as the core declares it
        const payload = ctx.payload as { nodeId: string; position: XY };
        const { nodeId, position } = payload;
        const node: Sized | undefined = ctx.get("node-by", { id: nodeId });
        if (!node || node.parentId !== undefined) return next();
        const current = drag;
        if (ctx.transient) {
            if (current?.nodeId !== nodeId) {
                drag = { nodeId, from: node.position };
            }
        } else {
            // the drop ends the drag; a move without one is not snapped
            drag = undefined;
            if (current?.nodeId !== nodeId) return next();
            const { from } = current;
            if (position.x === from.x && position.y === from.y) return next();
        }
        const box = { ...boxOf(node), x: position.x, y: position.y };
        const snapped = {
            ...payload,
            position: snapBox(
                box,
                othersOf(ctx.state.nodes, nodeId),
                threshold,
            ),
        };
        ctx.payload = snapped as typeof ctx.payload;
        return next();
    };
}
