import type {
    HandleSide,
    NodeToolbarPosition,
    PartAttributes,
} from "@fragiola/flow";
import { h, inject, Teleport } from "vue";
import { useFlowValue } from "../composables/internal";
import { NodeKey, useFlowContext } from "../context";
import {
    definePrimitive,
    type FlowComponent,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";

export interface NodeToolbarState {
    /** its node (undefined for several nodes' toolbar) */
    readonly nodeId: string | undefined;
    /** the nodes it stands beside: `nodeIds`, or its one node */
    readonly nodeIds: readonly string[];
    /** where it is anchored, in pixels relative to the root */
    readonly position: NodeToolbarPosition;
    readonly side: HandleSide;
}

export interface NodeToolbarProps extends PrimitiveProps {
    /** its node; default the enclosing `Flow.Node`'s */
    nodeId?: string | undefined;
    /**
     * several nodes it stands beside (their bounds), instead of one; when not empty it wins over
     * `nodeId`, and the toolbar is shown by default while every one of them is selected
     */
    nodeIds?: readonly string[] | undefined;
    /** the node's side it stands on; default `"top"` */
    side?: HandleSide | undefined;
    /** where along that side; default `"center"` */
    align?: "start" | "center" | "end" | undefined;
    /** the gap between the node and the toolbar, in pixels; default 10 */
    offset?: number | undefined;
    /** whether it is shown; default while its node (every node of `nodeIds`) is selected (`selection()`) */
    open?: boolean | undefined;
}

export interface NodeToolbarSlots extends RenderSlot<NodeToolbarState> {
    /** your buttons */
    default?: SlotFunction<{ state: NodeToolbarState }>;
}

interface ToolbarView {
    position: NodeToolbarPosition;
    nodeIds: readonly string[];
    attributes: PartAttributes;
}

/**
 * A toolbar next to a node, or beside several nodes' bounds (`nodeIds`; `data-flow-part="toolbar"`),
 * outside the zoom: rendered in
 * `Flow.Root` (a `Teleport`), at the anchor `node-toolbar-by` gives, so it keeps its size at any
 * zoom. Presses and the wheel over it are left to it. It renders only its default slot (your
 * buttons).
 */
export const NodeToolbar: FlowComponent<NodeToolbarProps, NodeToolbarSlots> =
    definePrimitive<NodeToolbarProps, NodeToolbarSlots>(
        "NodeToolbar",
        ["nodeId", "nodeIds", "side", "align", "offset", "open", "as"],
        (props, { attrs, slots }) => {
            const context = useFlowContext("NodeToolbar");
            const { model } = context;
            const around = inject(NodeKey, null);
            // several nodes (`nodeIds` not empty), or one: the given one or the enclosing node's
            const many = () =>
                props.nodeIds !== undefined && props.nodeIds.length > 0;
            const nodeId = (): string | undefined => {
                if (many()) return undefined;
                const id = props.nodeId ?? around?.nodeId();
                if (id === undefined) {
                    throw new Error(
                        "Flow.NodeToolbar must be rendered inside Flow.Node (or be given a nodeId or nodeIds)",
                    );
                }
                return id;
            };
            // hidden, it reads nothing of the view: a pan or a zoom gives the same value (nothing
            // renders again); shown, an equal anchor keeps the last value
            const view = useFlowValue<ToolbarView | undefined>(context, () => {
                const engine = context.engine.value;
                if (!engine) return undefined;
                const id = nodeId();
                const nodeIds =
                    id === undefined ? [...(props.nodeIds ?? [])] : [id];
                const shown =
                    props.open ??
                    nodeIds.every((node) =>
                        model.is("node-selected", { nodeId: node }),
                    );
                if (!shown) return undefined;
                const position = engine.get("node-toolbar-by", {
                    ...(id === undefined ? { nodeIds } : { nodeId: id }),
                    side: props.side ?? "top",
                    align: props.align,
                    offset: props.offset,
                });
                return position
                    ? {
                          position,
                          nodeIds,
                          attributes: engine.adapter.attributes(
                              "toolbar",
                              id === undefined ? {} : { nodeId: id },
                          ),
                      }
                    : undefined;
            });
            return () => {
                const current = view.value;
                const root = context.rootElement.value;
                if (!current || !root) return null;
                const state: NodeToolbarState = {
                    nodeId: nodeId(),
                    nodeIds: current.nodeIds,
                    position: current.position,
                    side: props.side ?? "top",
                };
                const { x, y, anchorX, anchorY } = current.position;
                return h(Teleport, { to: root }, [
                    renderElement({
                        tag: "div",
                        as: props.as,
                        attrs,
                        render: slots.render,
                        state,
                        props: { ...current.attributes },
                        style: {
                            position: "absolute",
                            top: "0",
                            left: "0",
                            transform: `translate(${x}px, ${y}px) translate(${-anchorX * 100}%, ${-anchorY * 100}%)`,
                        },
                        children: () => slots.default?.({ state }),
                    }),
                ]);
            };
        },
        { booleans: ["open"] },
    );
