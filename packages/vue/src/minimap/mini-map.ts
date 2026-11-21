import { type MinimapView, partAttributes } from "@fragiola/flow";
import { h, provide } from "vue";
import { useFlowValue } from "../composables/internal";
import { MiniMapKey, useFlowContext } from "../context";
import {
    definePrimitive,
    type FlowComponent,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { px, type RenderSlot, renderElement } from "../utils/render";
import { MiniMapMask } from "./mini-map-mask";
import { MiniMapNode } from "./mini-map-node";

export interface MiniMapState {
    /** what it draws: the nodes, the view and the mask, in flow coordinates */
    readonly view: MinimapView;
}

export interface MiniMapProps extends PrimitiveProps {
    /** its width, in pixels; default 200 */
    width?: number | undefined;
    /** its height, in pixels; default 150 */
    height?: number | undefined;
}

export interface MiniMapSlots extends RenderSlot<MiniMapState> {
    /**
     * what it draws, in flow coordinates (`v-slot="{ view }"`); default a `MiniMapNode` per node,
     * then the `MiniMapMask`
     */
    default?: SlotFunction<{ view: MinimapView }>;
}

const EMPTY_VIEW: MinimapView = Object.freeze({
    viewBox: Object.freeze({ x: 0, y: 0, width: 0, height: 0 }),
    viewBoxAttribute: "0 0 0 0",
    scale: 1,
    nodes: Object.freeze([]),
    view: Object.freeze({ x: 0, y: 0, width: 0, height: 0 }),
    maskPath: "",
});

/**
 * A small map of the flow (`data-flow-part="minimap"`, `minimap()`): an SVG of `width` × `height`
 * pixels showing every node and what the root shows. With `minimap()`'s options, a drag on it pans
 * and its wheel zooms the flow. Inside `Flow.Root`, outside `Flow.Viewport`; place it with your
 * style.
 */
export const MiniMap: FlowComponent<MiniMapProps, MiniMapSlots> =
    definePrimitive<MiniMapProps, MiniMapSlots>(
        "MiniMap",
        ["width", "height", "as"],
        (props, { attrs, slots }) => {
            const context = useFlowContext("MiniMap");
            const width = () => props.width ?? 200;
            const height = () => props.height ?? 150;
            const view = useFlowValue(
                context,
                () =>
                    context.engine.value?.get("minimap-view", {
                        width: width(),
                        height: height(),
                    }) ?? EMPTY_VIEW,
                (a, b) =>
                    a === b ||
                    (a.viewBoxAttribute === b.viewBoxAttribute &&
                        a.maskPath === b.maskPath &&
                        a.nodes.length === b.nodes.length &&
                        a.nodes.every((node, i) => {
                            const other = b.nodes[i];
                            return (
                                other !== undefined &&
                                node.nodeId === other.nodeId &&
                                node.x === other.x &&
                                node.y === other.y &&
                                node.width === other.width &&
                                node.height === other.height
                            );
                        })),
            );
            const attributes = useFlowValue(context, () => {
                const engine = context.engine.value;
                return engine
                    ? engine.adapter.attributes("minimap")
                    : partAttributes("minimap");
            });
            provide(MiniMapKey, view);
            return () => {
                const current = view.value;
                return renderElement({
                    tag: "svg",
                    as: props.as,
                    attrs,
                    render: slots.render,
                    state: { view: current },
                    props: {
                        ...attributes.value,
                        viewBox: current.viewBoxAttribute,
                        width: width(),
                        height: height(),
                    },
                    style: { width: px(width()), height: px(height()) },
                    children: () =>
                        slots.default
                            ? slots.default({ view: current })
                            : [
                                  ...current.nodes.map((node) =>
                                      h(MiniMapNode, {
                                          key: node.nodeId,
                                          nodeId: node.nodeId,
                                      }),
                                  ),
                                  h(MiniMapMask),
                              ],
                });
            };
        },
    );
