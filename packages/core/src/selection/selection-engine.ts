// The selection feature's engine side: a tap on a node or an edge selects it (with the
// multi-selection key, Ctrl, ⌘ or Shift by default, it toggles, when `multiple`), a tap on the pane
// clears the selection, and a drag on the pane with the box key (Shift by default; any drag with
// `boxOnDrag`) draws a selection box that selects the nodes it holds (`"full"`) or touches
// (`"partial"`), with the edges between them. Each box step is a
// transient `selection.set`, the release the final one; a cancel puts the selection back.
import { flag } from "../attributes/part-attributes";
import type { FlowEdge, FlowNode, XY } from "../document/types";
import type { FeatureEngine, FeatureEngineHost } from "../features/types";
import { contains, overlaps, rectFromCorners } from "../geometry/rect";
import { toScreen } from "../geometry/viewport-math";
import type { SelectionKey, SelectionOptions } from "./selection";

interface Box {
    /** where it started, in client coordinates (its travel) and in flow coordinates (its corner) */
    readonly start: XY;
    readonly anchor: XY;
    current: XY;
    readonly before: { nodeIds: string[]; edgeIds: string[] };
    nodeIds: string[];
    edgeIds: string[];
    active: boolean;
}

/** The engine side of `selection()`. */
export function selectionEngine(
    host: FeatureEngineHost,
    options: SelectionOptions,
): FeatureEngine {
    const { model } = host;
    let box: Box | undefined;

    /** Whether one of `keys` is held during `event`. */
    const holds = (keys: SelectionKey, event: MouseEvent): boolean =>
        keys === null
            ? false
            : typeof keys === "string"
              ? host.held(keys, event)
              : keys.some((key) => host.held(key, event));

    const selected = () => ({
        nodeIds: (model.get("selected-nodes") as readonly FlowNode[]).map(
            (node) => node.id,
        ),
        edgeIds: (model.get("selected-edges") as readonly FlowEdge[]).map(
            (edge) => edge.id,
        ),
    });

    /** What the box holds now: its nodes, and the edges between two of them. */
    const inBox = (current: Box) => {
        const a = current.anchor;
        const b = host.toFlow(current.current);
        const area = rectFromCorners(a, b);
        const nodeIds = (model.get("all-nodes") as readonly FlowNode[])
            .filter((node) => {
                if (node.hidden === true) return false;
                if (!model.is("node-selectable", { nodeId: node.id }))
                    return false;
                if (!host.measured(node.id)) return false;
                const rect = host.nodeRect(node.id);
                if (!rect) return false;
                return options.boxMode === "partial"
                    ? overlaps(area, rect)
                    : contains(area, rect);
            })
            .map((node) => node.id);
        const set = new Set(nodeIds);
        const edgeIds = (model.get("all-edges") as readonly FlowEdge[])
            .filter(
                (edge) =>
                    set.has(edge.source) &&
                    set.has(edge.target) &&
                    model.is("edge-selectable", { edgeId: edge.id }),
            )
            .map((edge) => edge.id);
        return { nodeIds, edgeIds };
    };

    const same = (a: readonly string[], b: readonly string[]) =>
        a.length === b.length && a.every((id, i) => id === b[i]);

    return {
        get: {
            "selection-box": () => {
                if (!box?.active) return null;
                // the corner stays on its flow point when the view pans or zooms under it
                return rectFromCorners(
                    toScreen(host.viewport(), box.anchor),
                    host.toRoot(box.current),
                );
            },
        },
        is: {
            "box-selecting": () => box?.active === true,
        },
        pointerdown: (event, target) => {
            if (
                target.kind !== "pane" ||
                !host.interactive() ||
                !(options.boxOnDrag || holds(options.boxKey, event))
            ) {
                return undefined;
            }
            const start = { x: event.clientX, y: event.clientY };
            const before = selected();
            box = {
                start,
                anchor: host.toFlow(start),
                current: start,
                before,
                nodeIds: [],
                edgeIds: [],
                active: false,
            };
            return {
                autoPan: true,
                move: (moved) => {
                    const current = box;
                    if (!current) return;
                    current.current = { x: moved.clientX, y: moved.clientY };
                    if (!current.active) {
                        const travel = Math.hypot(
                            current.current.x - start.x,
                            current.current.y - start.y,
                        );
                        if (travel < 1) return;
                        current.active = true;
                    }
                    const held = inBox(current);
                    if (
                        !same(held.nodeIds, current.nodeIds) ||
                        !same(held.edgeIds, current.edgeIds)
                    ) {
                        current.nodeIds = held.nodeIds;
                        current.edgeIds = held.edgeIds;
                        model.run(
                            "selection.set",
                            { ...held, mode: "replace" },
                            { transient: true },
                        );
                    }
                    host.changed();
                },
                end: () => {
                    const current = box;
                    box = undefined;
                    if (!current?.active) return;
                    model.run("selection.set", {
                        nodeIds: current.nodeIds,
                        edgeIds: current.edgeIds,
                        mode: "replace",
                    });
                    host.changed();
                    host.emit({
                        type: "box-select",
                        nodeIds: current.nodeIds,
                        edgeIds: current.edgeIds,
                    });
                },
                cancel: () => {
                    const current = box;
                    box = undefined;
                    if (!current?.active) return;
                    model.run("selection.set", {
                        ...current.before,
                        mode: "replace",
                    });
                    host.changed();
                },
                active: () => box?.active === true,
            };
        },
        tap: (event, target) => {
            const toggle = options.multiple && holds(options.multiKey, event);
            const mode = toggle ? "toggle" : "replace";
            if (target.kind === "node" && target.nodeId !== undefined) {
                if (!model.is("node-selectable", { nodeId: target.nodeId }))
                    return false;
                return model.run("selection.set", {
                    nodeIds: [target.nodeId],
                    mode,
                }).ok;
            }
            if (target.kind === "edge" && target.edgeId !== undefined) {
                if (!model.is("edge-selectable", { edgeId: target.edgeId }))
                    return false;
                return model.run("selection.set", {
                    edgeIds: [target.edgeId],
                    mode,
                }).ok;
            }
            if (target.kind === "pane" && !toggle) {
                const now = selected();
                if (now.nodeIds.length === 0 && now.edgeIds.length === 0)
                    return false;
                return model.run("selection.clear", {}).ok;
            }
            return false;
        },
        attributes: (part, _payload, into) => {
            if (part === "selection-box" || part === "root") {
                into["data-selecting"] = flag(box?.active === true);
            }
        },
        detached: () => {
            box = undefined;
        },
    };
}
