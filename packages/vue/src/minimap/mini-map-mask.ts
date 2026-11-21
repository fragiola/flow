import { partAttributes } from "@fragiola/flow";
import {
    definePrimitive,
    type FlowComponent,
    type PrimitiveProps,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";
import { useMiniMapView } from "./mini-map-context";

/** The state of `MiniMapMask`: the root's view, in flow coordinates. */
export interface MiniMapMaskState {
    readonly view: { x: number; y: number; width: number; height: number };
}

export interface MiniMapMaskProps extends PrimitiveProps {}

export interface MiniMapMaskSlots extends RenderSlot<MiniMapMaskState> {}

/**
 * The `MiniMap`'s mask (`data-flow-part="minimap-mask"`): an SVG path covering the map but what the
 * root shows (`fill-rule="evenodd"`). Give it its fill.
 */
export const MiniMapMask: FlowComponent<MiniMapMaskProps, MiniMapMaskSlots> =
    definePrimitive<MiniMapMaskProps, MiniMapMaskSlots>(
        "MiniMapMask",
        ["as"],
        (props, { attrs, slots }) => {
            const view = useMiniMapView("MiniMapMask");
            return () =>
                renderElement({
                    tag: "path",
                    as: props.as,
                    attrs,
                    render: slots.render,
                    state: { view: view.value.view },
                    props: {
                        ...partAttributes("minimap-mask"),
                        d: view.value.maskPath,
                        "fill-rule": "evenodd",
                    },
                });
        },
    );
