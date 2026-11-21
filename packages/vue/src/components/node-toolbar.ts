import type {
    HandleSide,
    NodeToolbarPosition,
    PartAttributes,
} from "@fragiola/flow";
import { h, Teleport } from "vue";
import { useFlowValue } from "../composables/internal";
import { useFlowContext, useNodeId } from "../context";
import {
    definePrimitive,
    type FlowComponent,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";

export interface NodeToolbarState {
    readonly nodeId: string;
    /** where it is anchored, in pixels relative to the root */
    readonly position: NodeToolbarPosition;
    readonly side: HandleSide;
}

export interface NodeToolbarProps extends PrimitiveProps {
    /** its node; default the enclosing `Flow.Node`'s */
    nodeId?: string | undefined;
    /** the node's side it stands on; default `"top"` */
    side?: HandleSide | undefined;
    /** where along that side; default `"center"` */
    align?: "start" | "center" | "end" | undefined;
    /** the gap between the node and the toolbar, in pixels; default 10 */
    offset?: number | undefined;
    /** whether it is shown; default while its node is selected (`selection()`) */
    open?: boolean | undefined;
}

export interface NodeToolbarSlots extends RenderSlot<NodeToolbarState> {
    /** your buttons */
    default?: SlotFunction<{ state: NodeToolbarState }>;
}

interface ToolbarView {
    position: NodeToolbarPosition;
    attributes: PartAttributes;
    selected: boolean;
}

/**
 * A toolbar next to a node (`data-flow-part="toolbar"`), outside the zoom: rendered in
 * `Flow.Root` (a `Teleport`), at the anchor `node-toolbar-by` gives, so it keeps its size at any
 * zoom. Presses and the wheel over it are left to it. It renders only its default slot (your
 * buttons).
 */
export const NodeToolbar: FlowComponent<NodeToolbarProps, NodeToolbarSlots> =
    definePrimitive<NodeToolbarProps, NodeToolbarSlots>(
        "NodeToolbar",
        ["nodeId", "side", "align", "offset", "open", "as"],
        (props, { attrs, slots }) => {
            const context = useFlowContext("NodeToolbar");
            const { model } = context;
            const nodeId = useNodeId("NodeToolbar", () => props.nodeId);
            const view = useFlowValue<ToolbarView | undefined>(context, () => {
                const engine = context.engine.value;
                if (!engine) return undefined;
                const id = nodeId();
                const position = engine.get("node-toolbar-by", {
                    nodeId: id,
                    side: props.side ?? "top",
                    align: props.align,
                    offset: props.offset,
                });
                return position
                    ? {
                          position,
                          attributes: engine.adapter.attributes("toolbar", {
                              nodeId: id,
                          }),
                          selected: model.is("node-selected", { nodeId: id }),
                      }
                    : undefined;
            });
            return () => {
                const current = view.value;
                const root = context.rootElement.value;
                const shown = props.open ?? current?.selected ?? false;
                if (!current || !shown || !root) return null;
                const state: NodeToolbarState = {
                    nodeId: nodeId(),
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
