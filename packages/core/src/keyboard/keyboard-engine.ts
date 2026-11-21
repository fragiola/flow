// The keyboard feature's engine side: nodes and edges take DOM focus (`node-focusable`,
// `edge-focusable`: the adapter sets `tabindex="0"`, so Tab walks them in drawing order) and a node
// that takes focus is panned into view. On a focused node or edge:
// - the arrows move the selected nodes (or the focused node) by `step` flow units, `fastStep`
//   with Shift, kept inside their parents (`node.move`, a `batch` for several: one step);
// - Enter and Space select it (with Ctrl, ⌘ or Shift they toggle it);
// - Delete and Backspace remove the selection (`selection.remove`), or without `selection()` the
//   focused node or edge;
// - Escape clears the selection (a gesture under way is cancelled by the engine first).
import type { FlowEdge, FlowNode, XY } from "../document/types";
import { movedRoots, parentOrigin, runMoves } from "../engine/node-moves";
import type { FeatureEngine, FeatureEngineHost } from "../features/types";
import { centeredOn, viewRect } from "../geometry/viewport-math";
import type { KeyboardOptions } from "./keyboard";

const ARROWS: Readonly<Record<string, XY>> = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
};

/** The engine side of `keyboard()`. */
export function keyboardEngine(
    host: FeatureEngineHost,
    options: KeyboardOptions,
): FeatureEngine {
    const { model } = host;

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
            const absolute = model.get("absolute-position-by", { nodeId }) as
                | XY
                | undefined;
            if (!absolute) return [];
            const origin = parentOrigin(model, nodeId);
            return [
                {
                    nodeId,
                    position: host.keepInParent(nodeId, {
                        x: absolute.x + direction.x * distance - origin.x,
                        y: absolute.y + direction.y * distance - origin.y,
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
            const nodeId = target.kind === "node" ? target.nodeId : undefined;
            const edgeId = target.kind === "edge" ? target.edgeId : undefined;
            const onEntity = nodeId !== undefined || edgeId !== undefined;
            const direction = ARROWS[event.key];
            if (direction) {
                if (event.altKey || event.ctrlKey || event.metaKey)
                    return false;
                return move(direction, event.shiftKey, nodeId);
            }
            if (event.key === "Delete" || event.key === "Backspace") {
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
