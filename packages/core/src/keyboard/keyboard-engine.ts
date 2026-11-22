// The keyboard feature's engine side: nodes and edges take DOM focus (`node-focusable`,
// `edge-focusable`: the adapter sets `tabindex="0"`, so Tab walks them in drawing order) and a node
// that takes focus is panned into view. On a focused node or edge:
// - the arrows move the selected nodes (or the focused node) by `step` flow units, `fastStep`
//   with Shift, kept inside their extents (`node.move`, a `batch` for several: one step);
// - Enter and Space select it (with Ctrl, ⌘ or Shift they toggle it);
// - the delete keys (`deleteKeys`: Delete and Backspace by default) remove the selection
//   (`selection.remove`), or without `selection()` the focused node or edge;
// - Escape clears the selection (a gesture under way is cancelled by the engine first).
// With `connection()`, handles take focus too (`tabindex` in their attributes) and Enter or Space
// on one starts a keyboard connection (Tab, Shift + Tab or the arrows walk the targets the model
// accepts, nearest first; Enter or Space connect; Escape cancels); with `resize()`, resize handles
// take focus and the arrows move their sides. Both are reached through the host's keyboard links,
// never by importing those features.
import type { FlowEdge, FlowNode, XY } from "../document/types";
import { movedRoots, runMoves } from "../engine/node-moves";
import {
    type KeyboardConnection,
    keyboardLinks,
} from "../features/keyboard-links";
import type {
    FeatureEngine,
    FeatureEngineHost,
    FeatureGesture,
} from "../features/types";
import { centeredOn, viewRect } from "../geometry/viewport-math";
import type { KeyboardOptions } from "./keyboard";

const ARROWS: Readonly<Record<string, XY>> = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
};

/** The keys that walk a keyboard connection's targets: the next one, or the previous one. */
const TARGET_STEPS: Readonly<Record<string, 1 | -1>> = {
    ArrowRight: 1,
    ArrowDown: 1,
    ArrowLeft: -1,
    ArrowUp: -1,
};

/** Enter or Space, without a modifier (Shift aside). */
function activates(event: KeyboardEvent): boolean {
    return (
        (event.key === "Enter" || event.key === " ") &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey
    );
}

/**
 * The gesture of a keyboard connection, given to the engine (it goes on without a press): Tab and
 * Shift + Tab or the arrows walk its targets, Enter or Space connect, Escape (the engine's)
 * cancels, as a press anywhere does.
 */
function connectionGesture(connection: KeyboardConnection): FeatureGesture {
    return {
        move: () => {},
        end: () => connection.cancel(),
        cancel: () => connection.cancel(),
        active: () => connection.open(),
        keydown: (event) => {
            if (event.altKey || event.ctrlKey || event.metaKey) return false;
            if (event.key === "Tab") {
                connection.next(event.shiftKey ? -1 : 1);
                return true;
            }
            const step = TARGET_STEPS[event.key];
            if (step !== undefined) {
                connection.next(step);
                return true;
            }
            if (activates(event)) {
                connection.connect();
                return true;
            }
            return false;
        },
    };
}

/** The engine side of `keyboard()`. */
export function keyboardEngine(
    host: FeatureEngineHost,
    options: KeyboardOptions,
): FeatureEngine {
    const { model } = host;
    const links = keyboardLinks(host);

    const move = (
        direction: XY,
        fast: boolean,
        focused: string | undefined,
    ): boolean => {
        const selected = (
            (model.get("selected-nodes") as readonly FlowNode[] | undefined) ??
            []
        ).map((node) => node.id);
        const ids =
            selected.length > 0
                ? selected
                : focused === undefined
                  ? []
                  : [focused];
        const nodeIds = movedRoots(
            model,
            ids.filter((nodeId) => model.is("node-draggable", { nodeId })),
        );
        if (nodeIds.length === 0) return false;
        const distance = fast ? options.fastStep : options.step;
        const moves = nodeIds.flatMap((nodeId) => {
            const node = model.get("node-by", { id: nodeId }) as
                | FlowNode
                | undefined;
            if (!node) return [];
            return [
                {
                    nodeId,
                    position: host.keepInExtent(nodeId, {
                        x: node.position.x + direction.x * distance,
                        y: node.position.y + direction.y * distance,
                    }),
                },
            ];
        });
        if (!runMoves(model, moves, false)) return false;
        host.emit({ type: "nodes-move", nodeIds, source: "keyboard" });
        return true;
    };

    const remove = (
        nodeId: string | undefined,
        edgeId: string | undefined,
    ): boolean => {
        if (model.can("selection.remove", {})) {
            const result = model.run("selection.remove", {});
            if (!result.ok) return false;
            const { removedNodeIds, removedEdgeIds } = result.value as {
                removedNodeIds: string[];
                removedEdgeIds: string[];
            };
            if (removedNodeIds.length + removedEdgeIds.length === 0)
                return false;
            host.emit({
                type: "remove",
                nodeIds: removedNodeIds,
                edgeIds: removedEdgeIds,
            });
            return true;
        }
        if (nodeId !== undefined) {
            const result = model.run("node.remove", { nodeId });
            if (!result.ok) return false;
            const { removedNodeIds, removedEdgeIds } = result.value as {
                removedNodeIds: string[];
                removedEdgeIds: string[];
            };
            host.emit({
                type: "remove",
                nodeIds: removedNodeIds,
                edgeIds: removedEdgeIds,
            });
            return true;
        }
        if (edgeId !== undefined && model.run("edge.remove", { edgeId }).ok) {
            host.emit({ type: "remove", nodeIds: [], edgeIds: [edgeId] });
            return true;
        }
        return false;
    };

    return {
        is: {
            "node-focusable": (payload) => {
                const node = model.get("node-by", {
                    id: String((payload as { nodeId?: unknown }).nodeId),
                }) as FlowNode | undefined;
                return node !== undefined && node.hidden !== true;
            },
            "edge-focusable": (payload) => {
                const edge = model.get("edge-by", {
                    id: String((payload as { edgeId?: unknown }).edgeId),
                }) as FlowEdge | undefined;
                return edge !== undefined && edge.hidden !== true;
            },
        },
        keydown: (event, target) => {
            if (!host.interactive()) return false;
            // Enter or Space on a focused handle starts a keyboard connection (`connection()`)
            if (
                target.kind === "handle" &&
                target.handle !== undefined &&
                links.connect !== undefined &&
                activates(event)
            ) {
                const connection = links.connect.start(target.handle);
                return connection ? connectionGesture(connection) : false;
            }
            const nodeId = target.kind === "node" ? target.nodeId : undefined;
            const edgeId = target.kind === "edge" ? target.edgeId : undefined;
            const onEntity = nodeId !== undefined || edgeId !== undefined;
            const direction = ARROWS[event.key];
            if (direction) {
                if (event.altKey || event.ctrlKey || event.metaKey)
                    return false;
                return move(direction, event.shiftKey, nodeId);
            }
            if (
                options.deleteKeys.some(
                    (name) => name === event.key || name === event.code,
                )
            ) {
                return remove(nodeId, edgeId);
            }
            if ((event.key === "Enter" || event.key === " ") && onEntity) {
                const mode =
                    event.shiftKey || event.ctrlKey || event.metaKey
                        ? "toggle"
                        : "replace";
                return model.run(
                    "selection.set",
                    nodeId !== undefined
                        ? { nodeIds: [nodeId], mode }
                        : { edgeIds: [edgeId as string], mode },
                ).ok;
            }
            if (event.key === "Escape") {
                const any =
                    ((
                        model.get("selected-nodes") as
                            | readonly unknown[]
                            | undefined
                    )?.length ?? 0) +
                        ((
                            model.get("selected-edges") as
                                | readonly unknown[]
                                | undefined
                        )?.length ?? 0) >
                    0;
                return any && model.run("selection.clear", {}).ok;
            }
            return false;
        },
        attributes: (part, payload, into) => {
            // a handle takes focus only with `connection()` too, a resize handle with `resize()`:
            // an app without them keeps its tab order
            if (part === "handle" && links.connect !== undefined) {
                const nodeId = payload.nodeId;
                if (
                    payload.connectable !== false &&
                    typeof nodeId === "string" &&
                    model.is("node-connectable", { nodeId })
                ) {
                    into.tabindex = "0";
                }
            } else if (part === "resize-handle" && links.resize !== undefined) {
                into.tabindex = "0";
            }
        },
        focus: (target) => {
            if (target.kind !== "node" || target.nodeId === undefined) return;
            const rect = host.measured(target.nodeId)
                ? host.nodeRect(target.nodeId)
                : undefined;
            const size = host.rootSize();
            if (!rect || size.width <= 0 || size.height <= 0) return;
            const viewport = host.viewport();
            const view = viewRect(viewport, size);
            const inside =
                rect.x >= view.x &&
                rect.y >= view.y &&
                rect.x + rect.width <= view.x + view.width &&
                rect.y + rect.height <= view.y + view.height;
            if (!inside) {
                host.setViewport(
                    centeredOn(
                        {
                            x: rect.x + rect.width / 2,
                            y: rect.y + rect.height / 2,
                        },
                        viewport.zoom,
                        size,
                    ),
                );
            }
        },
    };
}
