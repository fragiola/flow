import { partAttributes } from "@fragiola/flow";
import { useFlowValue } from "../composables/internal";
import { useFlowContext } from "../context";
import {
    definePrimitive,
    type FlowComponent,
    type PrimitiveProps,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";
import { useMiniMapView } from "./mini-map-context";

export interface MiniMapNodeState {
    readonly nodeId: string;
    /** `data-selected` (`selection()`) */
    readonly selected: boolean;
}

export interface MiniMapNodeProps extends PrimitiveProps {
    /** the node it stands for */
    nodeId: string;
}

export interface MiniMapNodeSlots extends RenderSlot<MiniMapNodeState> {}

/**
 * A node in the `MiniMap` (`data-flow-part="minimap-node"`, `data-flow-id`): an SVG rectangle of
 * the node's box, in flow coordinates. Nothing when the node is not shown.
 */
export const MiniMapNode: FlowComponent<MiniMapNodeProps, MiniMapNodeSlots> =
    definePrimitive<MiniMapNodeProps, MiniMapNodeSlots>(
        "MiniMapNode",
        ["nodeId", "as"],
        (props, { attrs, slots }) => {
            const view = useMiniMapView("MiniMapNode");
            const context = useFlowContext("MiniMapNode");
            const attributes = useFlowValue(context, () => {
                const engine = context.engine.value;
                return engine
                    ? engine.adapter.attributes("minimap-node", {
                          nodeId: props.nodeId,
                      })
                    : partAttributes("minimap-node", props.nodeId);
            });
            return () => {
                const box = view.value.nodes.find(
                    (node) => node.nodeId === props.nodeId,
                );
                if (!box) return null;
                const own = attributes.value;
                return renderElement({
                    tag: "rect",
                    as: props.as,
                    attrs,
                    render: slots.render,
                    state: {
                        nodeId: props.nodeId,
                        selected: own["data-selected"] !== undefined,
                    },
                    props: {
                        ...own,
                        x: box.x,
                        y: box.y,
                        width: box.width,
                        height: box.height,
                    },
                });
            };
        },
    );
