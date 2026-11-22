// The resize feature's engine side (the NodeResizer): a press on one of a node's eight resize
// handles (`data-position`: `top-left`, `top`, `top-right`, `right`, `bottom-right`, `bottom`,
// `bottom-left`, `left`) resizes it from that corner or side, the opposite one staying put. Its
// limits are the feature's options, over which a resizer's own (`engine.adapter.setPartOptions(
// "resizer", nodeId, …)`) win; with `keepAspectRatio` the width-to-height ratio stays. A node stays
// inside its extent (its parent's box with `extent: "parent"`, its rectangle `extent`, the engine's
// `nodeExtent`), and a parent never shrinks past its children with `extent: "parent"`; resizing
// from a top or left edge moves the parent's top-left corner, so its children move back by as much
// and stay where they are on screen (a parent holding a child that is not draggable keeps its top
// and left edges). It works on the node's absolute box, so the `nodeOrigin` is applied once, when
// the box becomes a position. Each step is transient, the release the final one. With
// `keyboard()`, the arrows on a focused resize handle move its sides by the keyboard's step, the
// same rules kept, each key one final step (offered through the host's keyboard links). A handle's
// own direction (`data-direction`, #40) wins over its resizer's, for a press and for a key.
import { flag } from "../attributes/part-attributes";
import type { BatchEntry } from "../commands/types";
import type { FlowNode, XY } from "../document/types";
import { keyboardLinks } from "../features/keyboard-links";
import type {
    FeatureEngine,
    FeatureEngineHost,
    FeatureGesture,
} from "../features/types";
import type { Rect } from "../geometry/types";
import type { ResizeDirection, ResizeOptions } from "./resize";

/** What a resize is kept to: the feature's options, a resizer's own over them, and its direction. */
export interface ResizeLimits
    extends Omit<ResizeOptions, "snap">,
        Partial<Pick<ResizeOptions, "snap">> {
    readonly direction?: ResizeDirection | undefined;
}

/** The corners and sides a resize handle may be on. */
export const RESIZE_POSITIONS = [
    "top-left",
    "top",
    "top-right",
    "right",
    "bottom-right",
    "bottom",
    "bottom-left",
    "left",
] as const;

/** A resize handle's position. */
export type ResizePosition = (typeof RESIZE_POSITIONS)[number];

interface Start {
    readonly nodeId: string;
    /** its position at the start (a cancel puts it back) */
    readonly position: XY;
    /** its absolute box at the start */
    readonly rect: Rect;
    readonly children: readonly FlowNode[];
}

const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), Math.max(min, max));

const snapTo = (value: number, grid: number) =>
    grid > 0 ? Math.round(value / grid) * grid : value;

/**
 * A node's box after a resize from `position` by `delta` (flow units), before the parent's rules:
 * with a `direction`, only its sides move; with `snap`, the moved sides land on the grid.
 */
export function resizedRect(
    start: Rect,
    position: ResizePosition,
    delta: XY,
    limits: ResizeLimits,
): Rect {
    const { direction, snap } = limits;
    const left = direction !== "vertical" && position.includes("left");
    const right = direction !== "vertical" && position.includes("right");
    const top = direction !== "horizontal" && position.startsWith("top");
    const bottom = direction !== "horizontal" && position.startsWith("bottom");
    const moved = { ...delta };
    if (snap) {
        // the moved side's new place, snapped, gives the delta
        const edgeX = left ? start.x : start.x + start.width;
        const edgeY = top ? start.y : start.y + start.height;
        moved.x = snapTo(edgeX + delta.x, snap.x) - edgeX;
        moved.y = snapTo(edgeY + delta.y, snap.y) - edgeY;
    }
    let width = start.width + (right ? moved.x : left ? -moved.x : 0);
    let height = start.height + (bottom ? moved.y : top ? -moved.y : 0);
    if (
        limits.keepAspectRatio &&
        direction === undefined &&
        start.width > 0 &&
        start.height > 0
    ) {
        const horizontal = left || right;
        const vertical = top || bottom;
        // a corner follows the larger change; a side drives the other dimension
        let scale =
            horizontal && vertical
                ? Math.abs(width / start.width - 1) >=
                  Math.abs(height / start.height - 1)
                    ? width / start.width
                    : height / start.height
                : horizontal
                  ? width / start.width
                  : height / start.height;
        scale = clamp(
            scale,
            Math.max(
                limits.minWidth / start.width,
                limits.minHeight / start.height,
            ),
            Math.min(
                limits.maxWidth / start.width,
                limits.maxHeight / start.height,
            ),
        );
        width = start.width * scale;
        height = start.height * scale;
    } else {
        width = clamp(width, limits.minWidth, limits.maxWidth);
        height = clamp(height, limits.minHeight, limits.maxHeight);
    }
    return {
        x: left ? start.x + start.width - width : start.x,
        y: top ? start.y + start.height - height : start.y,
        width,
        height,
    };
}

/** The engine side of `resize()`. */
export function resizeEngine(
    host: FeatureEngineHost,
    options: ResizeOptions,
): FeatureEngine {
    const { model } = host;
    let resizing: string | undefined;

    const limitsOf = (nodeId: string): ResizeLimits => {
        const own = host.partOptions("resizer", nodeId) ?? {};
        const pick = <K extends keyof ResizeOptions>(
            key: K,
        ): ResizeOptions[K] =>
            (typeof own[key] === typeof options[key]
                ? own[key]
                : options[key]) as ResizeOptions[K];
        return {
            minWidth: pick("minWidth"),
            minHeight: pick("minHeight"),
            maxWidth: pick("maxWidth"),
            maxHeight: pick("maxHeight"),
            keepAspectRatio: pick("keepAspectRatio"),
            snap: options.snap,
            direction:
                own.direction === "horizontal" || own.direction === "vertical"
                    ? own.direction
                    : undefined,
        };
    };

    /** The box (absolute) kept to its extent and to its children's rules. */
    const kept = (
        start: Start,
        rect: Rect,
        position: ResizePosition,
        limits: ResizeLimits,
    ): Rect => {
        let { x, y, width, height } = rect;
        const left = position.includes("left");
        const top = position.startsWith("top");
        const from = start.rect;
        // the node stays inside its extent
        const bounds = host.extentOf(start.nodeId);
        if (bounds) {
            if (left && x < bounds.x) {
                width -= bounds.x - x;
                x = bounds.x;
            }
            if (top && y < bounds.y) {
                height -= bounds.y - y;
                y = bounds.y;
            }
            width = Math.min(width, bounds.x + bounds.width - x);
            height = Math.min(height, bounds.y + bounds.height - y);
            // a node already past its bounds gets no room there: it keeps its least size, never a
            // negative one
            if (width < 0) width = Math.min(limits.minWidth, rect.width);
            if (height < 0) height = Math.min(limits.minHeight, rect.height);
            // the bound wins over the limits; a kept ratio shrinks the other side to it
            if (
                limits.keepAspectRatio &&
                limits.direction === undefined &&
                from.width > 0 &&
                from.height > 0 &&
                (width !== rect.width || height !== rect.height)
            ) {
                const ratio = from.width / from.height;
                const fitted = Math.min(width, height * ratio);
                if (left) x += width - fitted;
                if (top) y += height - fitted / ratio;
                width = fitted;
                height = fitted / ratio;
            }
        }
        // a parent keeps its children with `extent: "parent"` inside, and its children's places
        const fixed = start.children.some(
            (child) => !model.is("node-draggable", { nodeId: child.id }),
        );
        const right = from.x + from.width;
        const bottom = from.y + from.height;
        if (fixed) {
            if (left) {
                x = from.x;
                width = from.width;
            }
            if (top) {
                y = from.y;
                height = from.height;
            }
        }
        const held = start.children.filter(
            (child) => child.extent === "parent",
        );
        for (const child of held) {
            const box = host.nodeRect(child.id);
            if (!box) continue;
            // a child's position is relative to its parent's top-left corner
            const childLeft = from.x + child.position.x;
            const childTop = from.y + child.position.y;
            if (left && x > childLeft) {
                x = childLeft;
                width = right - x;
            }
            if (top && y > childTop) {
                y = childTop;
                height = bottom - y;
            }
            width = Math.max(width, childLeft + box.width - x);
            height = Math.max(height, childTop + box.height - y);
        }
        return { x, y, width, height };
    };

    const stepOf = (start: Start, rect: Rect): BatchEntry[] => {
        const dx = rect.x - start.rect.x;
        const dy = rect.y - start.rect.y;
        const back =
            dx === 0 &&
            dy === 0 &&
            rect.width === start.rect.width &&
            rect.height === start.rect.height;
        const commands: BatchEntry[] = [
            {
                command: "node.resize",
                payload: {
                    nodeId: start.nodeId,
                    width: rect.width,
                    height: rect.height,
                    position: back
                        ? start.position
                        : host.positionFor(
                              start.nodeId,
                              { x: rect.x, y: rect.y },
                              rect,
                          ),
                },
            },
        ];
        if (dx !== 0 || dy !== 0) {
            for (const child of start.children) {
                commands.push({
                    command: "node.move",
                    payload: {
                        nodeId: child.id,
                        position: {
                            x: child.position.x - dx,
                            y: child.position.y - dy,
                        },
                    },
                });
            }
        }
        return commands;
    };

    const run = (commands: BatchEntry[], transient: boolean) =>
        commands.length === 1
            ? model.run(
                  commands[0]?.command as "node.resize",
                  commands[0]?.payload as object,
                  {
                      transient,
                  },
              )
            : model.run("batch", { commands }, { transient });

    const gestureFor = (
        start: Start,
        position: ResizePosition,
        client: XY,
        own: ResizeDirection | undefined,
    ): FeatureGesture => {
        let active = false;
        let last: { commands: BatchEntry[]; rect: Rect } | undefined;
        // the handle's own direction (`data-direction`, read at the press) wins over its resizer's
        const resizer = limitsOf(start.nodeId);
        const limits = { ...resizer, direction: own ?? resizer.direction };
        // the flow point pressed: an auto-pan moves the flow under a still pointer
        const anchor = host.toFlow(client);
        return {
            autoPan: "resize",
            move: (event) => {
                const pointer = host.toFlow({
                    x: event.clientX,
                    y: event.clientY,
                });
                const delta = {
                    x: pointer.x - anchor.x,
                    y: pointer.y - anchor.y,
                };
                if (!active) {
                    if (delta.x === 0 && delta.y === 0) return;
                    active = true;
                    resizing = start.nodeId;
                    host.emit({
                        type: "resize-start",
                        nodeId: start.nodeId,
                        width: start.rect.width,
                        height: start.rect.height,
                    });
                }
                const rect = kept(
                    start,
                    resizedRect(start.rect, position, delta, limits),
                    position,
                    limits,
                );
                last = { commands: stepOf(start, rect), rect };
                run(last.commands, true);
                host.changed();
            },
            end: () => {
                resizing = undefined;
                if (!active || !last) return;
                run(last.commands, false);
                host.changed();
                host.emit({
                    type: "resize",
                    nodeId: start.nodeId,
                    width: last.rect.width,
                    height: last.rect.height,
                    source: "pointer",
                });
            },
            cancel: () => {
                resizing = undefined;
                if (!active) return;
                run(stepOf(start, start.rect), false);
                // the children go back to where they were
                host.changed();
                host.emit({ type: "resize-cancel", nodeId: start.nodeId });
            },
            active: () => active,
        };
    };

    /** Whether a resize may start from a handle at `position` now. */
    const resizable = (
        position: string | undefined,
    ): position is ResizePosition =>
        RESIZE_POSITIONS.includes(position as ResizePosition) &&
        host.interactive() &&
        resizing === undefined;

    /** What a resize of a measured node starts from: its position, its box, its children. */
    const startOf = (nodeId: string): Start | undefined => {
        const node = model.get("node-by", { id: nodeId }) as
            | FlowNode
            | undefined;
        const rect = host.nodeRect(nodeId);
        if (!node || !rect || !host.measured(nodeId)) return undefined;
        const children = (model.get("all-nodes") as readonly FlowNode[]).filter(
            (child) => child.parentId === nodeId,
        );
        return { nodeId, position: node.position, rect, children };
    };

    // with keyboard(): the arrows on a focused resize handle move its sides, one final step each
    keyboardLinks(host).resize = {
        step: (nodeId, position, delta, own) => {
            if (!resizable(position)) return false;
            // the arrow moves none of this handle's sides (its direction kept): not the
            // resizer's key
            const direction = own ?? limitsOf(nodeId).direction;
            const horizontal =
                direction !== "vertical" &&
                (position.includes("left") || position.includes("right"));
            const vertical =
                direction !== "horizontal" &&
                (position.startsWith("top") || position.startsWith("bottom"));
            if (
                !(horizontal && delta.x !== 0) &&
                !(vertical && delta.y !== 0)
            ) {
                return false;
            }
            const start = startOf(nodeId);
            if (!start) return false;
            // a key moves by the keyboard's step, never snapped back to where it was
            const limits = { ...limitsOf(nodeId), direction, snap: undefined };
            const rect = kept(
                start,
                resizedRect(start.rect, position, delta, limits),
                position,
                limits,
            );
            const from = start.rect;
            // at a limit the key is still the resizer's, and nothing runs
            if (
                rect.x === from.x &&
                rect.y === from.y &&
                rect.width === from.width &&
                rect.height === from.height
            ) {
                return true;
            }
            if (!run(stepOf(start, rect), false).ok) return true;
            host.changed();
            host.emit({
                type: "resize",
                nodeId,
                width: rect.width,
                height: rect.height,
                source: "keyboard",
            });
            return true;
        },
    };

    return {
        is: {
            resizing: () => resizing !== undefined,
            "node-resizing": (payload) =>
                resizing === (payload as { nodeId?: unknown }).nodeId,
        },
        pointerdown: (event, target) => {
            const { nodeId, position } = target;
            if (target.kind !== "resize-handle" || !resizable(position)) {
                return undefined;
            }
            const start = nodeId === undefined ? undefined : startOf(nodeId);
            return start
                ? gestureFor(
                      start,
                      position,
                      {
                          x: event.clientX,
                          y: event.clientY,
                      },
                      target.direction,
                  )
                : undefined;
        },
        attributes: (part, payload, into) => {
            if (part === "node" || part === "resizer") {
                into["data-resizing"] = flag(
                    resizing !== undefined && resizing === payload.nodeId,
                );
            }
        },
        detached: () => {
            resizing = undefined;
        },
    };
}
