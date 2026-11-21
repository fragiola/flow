// The resize feature's engine side (the NodeResizer): a press on one of a node's eight resize
// handles (`data-position`: `top-left`, `top`, `top-right`, `right`, `bottom-right`, `bottom`,
// `bottom-left`, `left`) resizes it from that corner or side, the opposite one staying put. Its
// limits are the feature's options, over which a resizer's own (`engine.adapter.setPartOptions(
// "resizer", nodeId, …)`) win; with `keepAspectRatio` the width-to-height ratio stays. A child with
// `extent: "parent"` stays inside its parent, and a parent never shrinks past its children with
// `extent: "parent"`; resizing from a top or left edge moves the parent's origin, so its children
// move back by as much and stay where they are on screen (a parent holding a child that is not
// draggable keeps its top and left edges). Each step is transient, the release the final one.
import { flag } from "../attributes/part-attributes";
import type { BatchEntry } from "../commands/types";
import type { FlowNode, XY } from "../document/types";
import type {
    FeatureEngine,
    FeatureEngineHost,
    FeatureGesture,
} from "../features/types";
import type { Rect } from "../geometry/types";
import type { ResizeOptions } from "./resize";

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
    readonly position: XY;
    readonly width: number;
    readonly height: number;
    readonly children: readonly FlowNode[];
}

const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), Math.max(min, max));

/** A node's box after a resize from `position` by `delta` (flow units), before the parent's rules. */
export function resizedRect(
    start: Rect,
    position: ResizePosition,
    delta: XY,
    limits: ResizeOptions,
): Rect {
    const left = position.includes("left");
    const right = position.includes("right");
    const top = position.startsWith("top");
    const bottom = position.startsWith("bottom");
    let width = start.width + (right ? delta.x : left ? -delta.x : 0);
    let height = start.height + (bottom ? delta.y : top ? -delta.y : 0);
    if (limits.keepAspectRatio && start.width > 0 && start.height > 0) {
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

    const limitsOf = (nodeId: string): ResizeOptions => {
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
        };
    };

    /** The box kept to the parent's rules (relative to the node's parent). */
    const kept = (start: Start, rect: Rect, position: ResizePosition): Rect => {
        let { x, y, width, height } = rect;
        const left = position.includes("left");
        const top = position.startsWith("top");
        const node = model.get("node-by", { id: start.nodeId }) as
            | FlowNode
            | undefined;
        // a child with `extent: "parent"` stays inside its parent
        if (
            node?.parentId !== undefined &&
            node.extent === "parent" &&
            node.expandParent !== true
        ) {
            const parent = host.nodeRect(node.parentId);
            if (left && x < 0) {
                width += x;
                x = 0;
            }
            if (top && y < 0) {
                height += y;
                y = 0;
            }
            if (parent && parent.width > 0)
                width = Math.min(width, parent.width - x);
            if (parent && parent.height > 0)
                height = Math.min(height, parent.height - y);
        }
        // a parent keeps its children with `extent: "parent"` inside, and its children's places
        const fixed = start.children.some(
            (child) => !model.is("node-draggable", { nodeId: child.id }),
        );
        const right = start.position.x + start.width;
        const bottom = start.position.y + start.height;
        if (fixed) {
            if (left) {
                x = start.position.x;
                width = start.width;
            }
            if (top) {
                y = start.position.y;
                height = start.height;
            }
        }
        const held = start.children.filter(
            (child) => child.extent === "parent",
        );
        for (const child of held) {
            const box = host.nodeRect(child.id);
            if (!box) continue;
            const childLeft = start.position.x + child.position.x;
            const childTop = start.position.y + child.position.y;
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
        const dx = rect.x - start.position.x;
        const dy = rect.y - start.position.y;
        const commands: BatchEntry[] = [
            {
                command: "node.resize",
                payload: {
                    nodeId: start.nodeId,
                    width: rect.width,
                    height: rect.height,
                    position: { x: rect.x, y: rect.y },
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
    ): FeatureGesture => {
        let active = false;
        let last: { commands: BatchEntry[]; rect: Rect } | undefined;
        const limits = limitsOf(start.nodeId);
        return {
            move: (event) => {
                const zoom = host.viewport().zoom;
                const delta = {
                    x: (event.clientX - client.x) / zoom,
                    y: (event.clientY - client.y) / zoom,
                };
                if (!active) {
                    if (delta.x === 0 && delta.y === 0) return;
                    active = true;
                    resizing = start.nodeId;
                }
                const rect = kept(
                    start,
                    resizedRect(
                        {
                            ...start.position,
                            width: start.width,
                            height: start.height,
                        },
                        position,
                        delta,
                        limits,
                    ),
                    position,
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
                });
            },
            cancel: () => {
                resizing = undefined;
                if (!active) return;
                run(
                    stepOf(start, {
                        ...start.position,
                        width: start.width,
                        height: start.height,
                    }),
                    false,
                );
                // the children go back to where they were
                host.changed();
            },
            active: () => active,
        };
    };

    return {
        is: {
            resizing: () => resizing !== undefined,
            "node-resizing": (payload) =>
                resizing === (payload as { nodeId?: unknown }).nodeId,
        },
        pointerdown: (event, target) => {
            const { nodeId, position } = target;
            if (
                target.kind !== "resize-handle" ||
                nodeId === undefined ||
                !RESIZE_POSITIONS.includes(position as ResizePosition) ||
                !host.interactive() ||
                resizing !== undefined
            ) {
                return undefined;
            }
            const node = model.get("node-by", { id: nodeId }) as
                | FlowNode
                | undefined;
            const rect = host.nodeRect(nodeId);
            if (!node || !rect || !host.measured(nodeId)) return undefined;
            const children = (
                model.get("all-nodes") as readonly FlowNode[]
            ).filter((child) => child.parentId === nodeId);
            return gestureFor(
                {
                    nodeId,
                    position: node.position,
                    width: rect.width,
                    height: rect.height,
                    children,
                },
                position as ResizePosition,
                { x: event.clientX, y: event.clientY },
            );
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
