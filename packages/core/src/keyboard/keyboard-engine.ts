// The keyboard feature's engine side: nodes and edges take DOM focus (`node-focusable`,
// `edge-focusable`: the adapter sets `tabindex="0"`, so Tab walks them in drawing order) and a node
// that takes focus is panned into view. On a focused node or edge:
// - the arrows move the selected nodes (or the focused node) by `step` flow units, `fastStep`
//   with Shift, kept inside their extents (`node.move`, a `batch` for several: one step);
// - Enter and Space select it (with Ctrl, ⌘ or Shift they toggle it);
// - the delete keys (`deleteKeys`: Delete and Backspace by default) remove the selection
//   (`selection.remove`), or without `selection()` the focused node or edge; a `beforeDelete`
//   is asked first and may narrow it, refuse it, or answer later (a promise: what is still there
//   when it settles goes, in one step);
// - Escape clears the selection (a gesture under way is cancelled by the engine first).
// With `connection()`, handles take focus too (`tabindex` in their attributes) and Enter or Space
// on one starts a keyboard connection (Tab, Shift + Tab or the arrows walk the targets the model
// accepts, nearest first; Enter or Space connect; Escape cancels); with `resize()`, resize handles
// take focus and the arrows move their sides. Both are reached through the host's keyboard links,
// never by importing those features.
import type { BatchEntry } from "../commands/types";
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
import type { DeleteDecision, KeyboardOptions } from "./keyboard";

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

/** Enter or Space, without a modifier (Shift aside), not a held key's repeat. */
function activates(event: KeyboardEvent): boolean {
    return (
        (event.key === "Enter" || event.key === " ") &&
        !event.repeat &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey
    );
}

/** Whether a key event comes from inside `element` (the handle a connection started at). */
function from(element: Element | undefined, event: KeyboardEvent): boolean {
    const target = event.target;
    return (
        element === undefined ||
        (typeof target === "object" &&
            target !== null &&
            element.contains(target as Node))
    );
}

/**
 * The gesture of a keyboard connection, given to the engine (it goes on without a press). Only the
 * keys of its source handle are its own: Tab and Shift + Tab or the arrows walk its targets, Enter
 * or Space connect, Escape (the engine's) cancels, as a press anywhere does. It also cancels when
 * focus leaves the handle (a field clicked, a toolbar button) and when its node goes away (a
 * delete key removed it), so a key elsewhere is never taken.
 */
function connectionGesture(
    connection: KeyboardConnection,
    source: Element | undefined,
    nodeId: string,
    model: FeatureEngineHost["model"],
): FeatureGesture {
    const stops: (() => void)[] = [];
    const release = () => {
        for (const stop of stops.splice(0)) stop();
    };
    const cancel = () => {
        release();
        connection.cancel();
    };
    if (source) {
        const left = () => cancel();
        source.addEventListener("focusout", left);
        stops.push(() => source.removeEventListener("focusout", left));
    }
    stops.push(
        model.subscribe(() => {
            if (!model.get("node-by", { id: nodeId })) cancel();
        }),
    );
    return {
        kind: "connect",
        move: () => {},
        end: cancel,
        cancel,
        active: () => connection.open(),
        keydown: (event) => {
            if (!from(source, event)) return false;
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
                release();
                connection.connect();
                return true;
            }
            // a held Enter's repeats neither connect nor reach the page
            if (event.key === "Enter" || event.key === " ") return event.repeat;
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
    /** a `beforeDelete` promise is pending: another delete key waits for it */
    let deciding = false;
    let destroyed = false;

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

    const nodeOf = (id: string) =>
        model.get("node-by", { id }) as FlowNode | undefined;
    const edgeOf = (id: string) =>
        model.get("edge-by", { id }) as FlowEdge | undefined;

    /** What a delete key would remove now: the selection's, or the focused node's or edge's. */
    const toRemove = (
        nodeId: string | undefined,
        edgeId: string | undefined,
    ): { nodeIds: string[]; edgeIds: string[] } | undefined => {
        const removed = (result: { ok: boolean; value?: unknown }) => {
            if (!result.ok) return undefined;
            const { removedNodeIds, removedEdgeIds } = result.value as {
                removedNodeIds: string[];
                removedEdgeIds: string[];
            };
            return { nodeIds: removedNodeIds, edgeIds: removedEdgeIds };
        };
        if (model.can("selection.remove", {}))
            return removed(model.check("selection.remove", {}));
        if (nodeId !== undefined)
            return removed(model.check("node.remove", { nodeId }));
        if (edgeId !== undefined && model.can("edge.remove", { edgeId }))
            return { nodeIds: [], edgeIds: [edgeId] };
        return undefined;
    };

    /**
     * Removes the nodes and edges still there among those given, in one step (a node takes its
     * edges and children; one carried by a removed parent is not removed twice), and tells it.
     */
    const removeIds = (
        nodeIds: readonly string[],
        edgeIds: readonly string[],
    ): boolean => {
        const nodes = nodeIds.filter(
            (id) =>
                nodeOf(id) !== undefined &&
                model.is("node-deletable", { nodeId: id }),
        );
        const roots = movedRoots(model, nodes);
        const gone = new Set(nodes);
        const edges = edgeIds.filter((id) => {
            const edge = edgeOf(id);
            return (
                edge !== undefined &&
                !gone.has(edge.source) &&
                !gone.has(edge.target) &&
                model.is("edge-deletable", { edgeId: id })
            );
        });
        const commands: BatchEntry[] = [
            ...edges.map((id) => ({
                command: "edge.remove" as const,
                payload: { edgeId: id },
            })),
            ...roots.map((id) => ({
                command: "node.remove" as const,
                payload: { nodeId: id },
            })),
        ];
        if (commands.length === 0) return false;
        const nodesBefore = model.get("all-nodes") as readonly FlowNode[];
        const edgesBefore = model.get("all-edges") as readonly FlowEdge[];
        const [only] = commands;
        const result =
            commands.length === 1 && only
                ? model.run(only.command, only.payload as object)
                : model.run("batch", { commands });
        if (!result.ok) return false;
        const removedNodeIds = nodesBefore
            .filter((node) => !nodeOf(node.id))
            .map((node) => node.id);
        const removedEdgeIds = edgesBefore
            .filter((edge) => !edgeOf(edge.id))
            .map((edge) => edge.id);
        host.emit({
            type: "remove",
            nodeIds: removedNodeIds,
            edgeIds: removedEdgeIds,
        });
        return true;
    };

    /** What a `beforeDelete` answer keeps of the nodes and edges it was asked about. */
    const decided = (
        decision: DeleteDecision,
        asked: { nodeIds: string[]; edgeIds: string[] },
    ): { nodeIds: string[]; edgeIds: string[] } => {
        if (decision === true) return asked;
        if (decision === false || typeof decision !== "object")
            return { nodeIds: [], edgeIds: [] };
        // a subset only: what it names that was asked about
        const nodes = new Set((decision.nodes ?? []).map((node) => node?.id));
        const edges = new Set((decision.edges ?? []).map((edge) => edge?.id));
        return {
            nodeIds: asked.nodeIds.filter((id) => nodes.has(id)),
            edgeIds: asked.edgeIds.filter((id) => edges.has(id)),
        };
    };

    /** A delete key with a `beforeDelete`: asked first, and waited for when it answers later. */
    const removeAsked = (
        nodeId: string | undefined,
        edgeId: string | undefined,
    ): boolean => {
        const before = options.beforeDelete;
        if (!before) return false;
        // a decision under way: this key waits for it (and is taken)
        if (deciding) return true;
        const asked = toRemove(nodeId, edgeId);
        if (!asked || asked.nodeIds.length + asked.edgeIds.length === 0)
            return false;
        const answer = before(
            asked.nodeIds.flatMap((id) => nodeOf(id) ?? []),
            asked.edgeIds.flatMap((id) => edgeOf(id) ?? []),
        );
        if (
            typeof answer === "object" &&
            answer !== null &&
            typeof (answer as Promise<unknown>).then === "function"
        ) {
            deciding = true;
            (answer as Promise<DeleteDecision>).then(
                (decision) => {
                    deciding = false;
                    // the flow locked or gone meanwhile: nothing goes
                    if (destroyed || !host.interactive()) return;
                    const kept = decided(decision, asked);
                    removeIds(kept.nodeIds, kept.edgeIds);
                },
                () => {
                    deciding = false;
                },
            );
            return true;
        }
        const kept = decided(answer as DeleteDecision, asked);
        removeIds(kept.nodeIds, kept.edgeIds);
        return true;
    };

    const remove = (
        nodeId: string | undefined,
        edgeId: string | undefined,
    ): boolean => {
        if (options.beforeDelete) return removeAsked(nodeId, edgeId);
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
                const node = nodeOf(
                    String((payload as { nodeId?: unknown }).nodeId),
                );
                return (
                    node !== undefined &&
                    node.hidden !== true &&
                    node.focusable !== false &&
                    host.focusable("node")
                );
            },
            "edge-focusable": (payload) => {
                const edge = edgeOf(
                    String((payload as { edgeId?: unknown }).edgeId),
                );
                return (
                    edge !== undefined &&
                    edge.hidden !== true &&
                    edge.focusable !== false &&
                    host.focusable("edge")
                );
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
                return connection
                    ? connectionGesture(
                          connection,
                          target.element,
                          target.handle.nodeId,
                          model,
                      )
                    : false;
            }
            const nodeId = target.kind === "node" ? target.nodeId : undefined;
            const edgeId = target.kind === "edge" ? target.edgeId : undefined;
            const onEntity = nodeId !== undefined || edgeId !== undefined;
            const direction = ARROWS[event.key];
            // the arrows on a focused resize handle move its sides (`resize()`)
            if (
                direction &&
                target.kind === "resize-handle" &&
                target.nodeId !== undefined &&
                target.position !== undefined &&
                links.resize !== undefined
            ) {
                if (event.altKey || event.ctrlKey || event.metaKey)
                    return false;
                const distance = event.shiftKey
                    ? options.fastStep
                    : options.step;
                return links.resize.step(target.nodeId, target.position, {
                    x: direction.x * distance,
                    y: direction.y * distance,
                });
            }
            if (direction) {
                if (event.altKey || event.ctrlKey || event.metaKey)
                    return false;
                if (!host.allows("drag")) return false;
                return move(direction, event.shiftKey, nodeId);
            }
            if (
                options.deleteKeys.some(
                    (name) => name === event.key || name === event.code,
                )
            ) {
                return remove(nodeId, edgeId);
            }
            if (
                (event.key === "Enter" || event.key === " ") &&
                onEntity &&
                host.allows("select")
            ) {
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
                    payload.connectableStart !== false &&
                    host.allows("connect") &&
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
            if (
                !options.panOnFocus ||
                target.kind !== "node" ||
                target.nodeId === undefined
            )
                return;
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
        destroy: () => {
            destroyed = true;
        },
    };
}
