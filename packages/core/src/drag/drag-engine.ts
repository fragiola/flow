// The drag feature's engine side (D9, D10): a press on a node that moves past the threshold drags
// it, with the selection when it is selected (and selects it first when it is not); every pointer
// move is a transient step (`node.move`, a `batch` for several), the drop the final one. Positions
// snap to the grid (the pressed node snaps, the others keep their offsets), and a node with
// an extent (`extent: "parent"`, a rectangle `extent`, the engine's `nodeExtent`) stays inside it
// with the measured sizes. A node holding a drag handle drags only from it. Escape,
// `pointercancel` or a lost capture puts the nodes back.
import { flag } from "../attributes/part-attributes";
import type { XY } from "../document/types";
import { carriedBy, runMoves } from "../engine/node-moves";
import type {
    FeatureEngine,
    FeatureEngineHost,
    FeatureGesture,
} from "../features/types";
import type { Rect } from "../geometry/types";
import type { DragOptions } from "./drag";

interface Drag {
    readonly nodeIds: readonly string[];
    /** each node's absolute position at the start (the snap's reference) */
    readonly starts: ReadonlyMap<string, XY>;
    /** each node's relative position at the start (a cancel puts it back) */
    readonly relatives: ReadonlyMap<string, XY>;
    /**
     * each node's absolute box at the start: a step puts it at its corner plus the pointer's
     * travel, relative to its parent's corner as it is then (a parent that grew, `expandParent`,
     * moved it)
     */
    readonly boxes: ReadonlyMap<string, Rect>;
}

/** The engine side of `drag()`. */
export function dragEngine(
    host: FeatureEngineHost,
    options: DragOptions,
): FeatureEngine {
    const { model } = host;
    let drag: Drag | undefined;

    const snap = (value: number, grid: number) =>
        grid > 0 ? Math.round(value / grid) * grid : value;

    const begin = (nodeId: string): Drag => {
        if (!model.is("node-selected", { nodeId })) {
            // a node dragged alone becomes the selection (refused without `selection()`)
            model.run("selection.set", { nodeIds: [nodeId] });
        }
        const nodeIds = carriedBy(model, nodeId);
        const starts = new Map<string, XY>();
        const relatives = new Map<string, XY>();
        const boxes = new Map<string, Rect>();
        for (const id of nodeIds) {
            const absolute = host.absolutePosition(id);
            const box = host.nodeRect(id);
            const node = model.get("node-by", { id }) as
                | { position: XY }
                | undefined;
            if (absolute && box && node) {
                starts.set(id, absolute);
                relatives.set(id, node.position);
                boxes.set(id, box);
            }
        }
        return { nodeIds: [...starts.keys()], starts, relatives, boxes };
    };

    const gestureFor = (nodeId: string, start: XY): FeatureGesture => {
        let active = false;
        // the flow point pressed: an auto-pan moves the flow under a still pointer
        const anchor = host.toFlow(start);
        /** The moves that put the dragged nodes under the pointer at `client`. */
        const movesAt = (current: Drag, client: XY) => {
            const pointer = host.toFlow(client);
            const delta = {
                x: pointer.x - anchor.x,
                y: pointer.y - anchor.y,
            };
            const lead =
                current.starts.get(nodeId) ??
                current.starts.values().next().value;
            if (lead && options.snapGrid) {
                const [gridX, gridY] = options.snapGrid;
                delta.x = snap(lead.x + delta.x, gridX) - lead.x;
                delta.y = snap(lead.y + delta.y, gridY) - lead.y;
            }
            return current.nodeIds.map((id) => {
                const box = current.boxes.get(id) as Rect;
                return {
                    nodeId: id,
                    position: host.keepInExtent(
                        id,
                        host.positionFor(
                            id,
                            { x: box.x + delta.x, y: box.y + delta.y },
                            box,
                        ),
                    ),
                };
            });
        };
        return {
            autoPan: true,
            move: (event) => {
                const client = { x: event.clientX, y: event.clientY };
                if (!active) {
                    if (
                        Math.hypot(client.x - start.x, client.y - start.y) <
                        options.threshold
                    ) {
                        return;
                    }
                    active = true;
                    drag = begin(nodeId);
                    host.emit({ type: "drag-start", nodeIds: drag.nodeIds });
                }
                const current = drag;
                if (!current) return;
                runMoves(model, movesAt(current, client), true);
                host.changed();
            },
            end: (event) => {
                const current = drag;
                drag = undefined;
                if (!active || !current) return;
                // the drop, from where the pointer is now (never a stored step: a parent that grew
                // since moved what the step was relative to)
                runMoves(
                    model,
                    movesAt(current, { x: event.clientX, y: event.clientY }),
                    false,
                );
                host.changed();
                host.emit({
                    type: "nodes-move",
                    nodeIds: current.nodeIds,
                    source: "pointer",
                });
            },
            cancel: () => {
                const current = drag;
                drag = undefined;
                if (!active || !current) return;
                runMoves(
                    model,
                    current.nodeIds.map((id) => ({
                        nodeId: id,
                        position: current.relatives.get(id) as XY,
                    })),
                    false,
                );
                host.changed();
                host.emit({ type: "drag-cancel", nodeIds: current.nodeIds });
            },
            active: () => active,
        };
    };

    return {
        get: {
            "dragging-node-ids": () => drag?.nodeIds ?? [],
        },
        is: {
            dragging: () => drag !== undefined,
            "node-dragging": (payload) =>
                drag?.nodeIds.includes(
                    String((payload as { nodeId?: unknown }).nodeId),
                ) ?? false,
        },
        pointerdown: (event, target) => {
            if (
                target.kind !== "node" ||
                target.nodeId === undefined ||
                target.outsideDragHandle === true ||
                drag !== undefined ||
                !host.interactive() ||
                !model.is("node-draggable", { nodeId: target.nodeId })
            ) {
                return undefined;
            }
            return gestureFor(target.nodeId, {
                x: event.clientX,
                y: event.clientY,
            });
        },
        attributes: (part, payload, into) => {
            if (part === "root")
                into["data-dragging"] = flag(drag !== undefined);
            if (part === "node") {
                into["data-dragging"] = flag(
                    drag?.nodeIds.includes(String(payload.nodeId)) ?? false,
                );
            }
        },
        detached: () => {
            drag = undefined;
        },
    };
}
