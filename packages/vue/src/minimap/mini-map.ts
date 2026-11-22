import { type MinimapView, partAttributes, type XY } from "@fragiola/flow";
import { h, provide, watchEffect } from "vue";
import { useFlowValue } from "../composables/internal";
import { MiniMapKey, useFlowContext } from "../context";
import {
    definePrimitive,
    type FlowComponent,
    NUMBER_PROP,
    numberProp,
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
    /**
     * a drag on it moves the view the other way (as grabbing the flow), and a press does not
     * centre the view; default `minimap()`'s `inversePan`
     */
    inversePan?: boolean | undefined;
    /**
     * how fast its wheel zooms: 10 is the flow's own wheel, 20 twice as fast; default
     * `minimap()`'s `zoomStep`. The attribute's text is its number (`zoom-step="20"`)
     */
    zoomStep?: number | `${number}` | undefined;
}

export type MiniMapEmits = {
    /**
     * a tap on it (`minimap-click`), with the flow point under the pointer on the minimap: center
     * the view there, add a node there (`@click`; the root captures the pointer, so a DOM click
     * never reaches the minimap)
     */
    click: (event: MouseEvent, point: XY) => void;
};

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
export const MiniMap: FlowComponent<MiniMapProps, MiniMapSlots, MiniMapEmits> =
    definePrimitive<MiniMapProps, MiniMapSlots, MiniMapEmits>(
        "MiniMap",
        ["width", "height", "inversePan", "zoomStep", "as"],
        (props, { attrs, slots, emit }) => {
            const context = useFlowContext("MiniMap");
            // its options over `minimap()`'s, one set for the root's minimaps (the engine's part
            // options), set again when one changes, cleared when it goes
            watchEffect((onCleanup) => {
                const engine = context.engine.value;
                if (!engine) return;
                const options = Object.fromEntries(
                    Object.entries({
                        inversePan: props.inversePan,
                        zoomStep: numberProp(props.zoomStep),
                    }).filter(([, value]) => value !== undefined),
                );
                engine.adapter.setPartOptions("minimap", "", options);
                onCleanup(() =>
                    engine.adapter.setPartOptions("minimap", "", null),
                );
            });
            // its taps (`minimap-click`), to the listener given now
            watchEffect((onCleanup) => {
                const engine = context.engine.value;
                if (!engine) return;
                const stop = engine.subscribe((event) => {
                    if (event.type === "minimap-click") {
                        emit("click", event.event, event.point);
                    }
                });
                onCleanup(stop);
            });
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
        {
            booleans: ["inversePan"],
            types: { zoomStep: NUMBER_PROP },
            emits: ["click"],
        },
    );
