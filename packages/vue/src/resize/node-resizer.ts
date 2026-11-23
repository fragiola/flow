import type { ResizeDirection } from "@fragiola/flow/resize";
import { h, watchEffect } from "vue";
import { sameValue, useFlowValue } from "../composables/internal";
import { useFlowContext, usePartNodeId } from "../context";
import {
    definePrimitive,
    type FlowComponent,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";
import { RESIZE_POSITIONS, ResizeHandle } from "./resize-handle";

export interface NodeResizerState {
    readonly nodeId: string;
    /** its node is being resized: `data-resizing` */
    readonly resizing: boolean;
}

export interface NodeResizerProps extends PrimitiveProps {
    /** its node; default the enclosing `Flow.Node`'s */
    nodeId?: string | undefined;
    /** this node's limits, over `resize()`'s (in flow units) */
    minWidth?: number | undefined;
    minHeight?: number | undefined;
    maxWidth?: number | undefined;
    maxHeight?: number | undefined;
    /** this node keeps its aspect ratio, over `resize()`'s */
    keepAspectRatio?: boolean | undefined;
    /**
     * the sides its handles move: `"horizontal"` only the width (and x), `"vertical"` only the
     * height (and y); default both. A corner then moves its one dimension
     */
    direction?: ResizeDirection | undefined;
}

export interface NodeResizerSlots extends RenderSlot<NodeResizerState> {
    /** its handles; default a `ResizeHandle` at each corner and side */
    default?: SlotFunction<{ state: NodeResizerState }>;
}

const RESIZER_STYLE = {
    position: "absolute",
    inset: "0",
    pointerEvents: "none",
};

/**
 * A node's resizer (`data-flow-part="resizer"`, `resize()`), inside `Flow.Node`: a box over the
 * node holding its `ResizeHandle`s; its limits are this node's own (`setPartOptions`). Render it
 * only when the node should be resizable (while it is selected, say).
 */
export const NodeResizer: FlowComponent<NodeResizerProps, NodeResizerSlots> =
    definePrimitive<NodeResizerProps, NodeResizerSlots>(
        "NodeResizer",
        [
            "nodeId",
            "minWidth",
            "minHeight",
            "maxWidth",
            "maxHeight",
            "keepAspectRatio",
            "direction",
            "as",
        ],
        (props, { attrs, slots }) => {
            const nodeId = usePartNodeId("NodeResizer", () => props.nodeId);
            const context = useFlowContext("NodeResizer");
            // this node's limits, set again when one changes, cleared when the resizer goes
            watchEffect((onCleanup) => {
                const engine = context.engine.value;
                if (!engine) return;
                const id = nodeId();
                const options = Object.fromEntries(
                    Object.entries({
                        minWidth: props.minWidth,
                        minHeight: props.minHeight,
                        maxWidth: props.maxWidth,
                        maxHeight: props.maxHeight,
                        keepAspectRatio: props.keepAspectRatio,
                        direction: props.direction,
                    }).filter(([, value]) => value !== undefined),
                );
                engine.adapter.setPartOptions("resizer", id, options);
                onCleanup(() =>
                    engine.adapter.setPartOptions("resizer", id, null),
                );
            });
            const attributes = useFlowValue(
                context,
                () => {
                    const engine = context.engine.value;
                    const id = nodeId();
                    return engine
                        ? engine.adapter.attributes("resizer", { nodeId: id })
                        : { "data-flow-part": "resizer", "data-flow-id": id };
                },
                sameValue,
                "entity",
            );
            return () => {
                const own = attributes.value;
                const state: NodeResizerState = {
                    nodeId: nodeId(),
                    resizing: own["data-resizing"] !== undefined,
                };
                return renderElement({
                    tag: "div",
                    as: props.as,
                    attrs,
                    render: slots.render,
                    state,
                    props: { ...own },
                    style: RESIZER_STYLE,
                    children: () =>
                        slots.default
                            ? slots.default({ state })
                            : RESIZE_POSITIONS.map((position) =>
                                  h(ResizeHandle, {
                                      key: position,
                                      position,
                                      nodeId: state.nodeId,
                                  }),
                              ),
                });
            };
        },
        { booleans: ["keepAspectRatio"] },
    );
