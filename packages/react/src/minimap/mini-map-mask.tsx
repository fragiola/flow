import { partAttributes } from "@fragiola/flow";
import { type SvgPrimitiveProps, useRenderElement } from "../utils/use-render";
import { useMiniMapView } from "./mini-map-context";

/** The state of `MiniMapMask`: the root's view, in flow coordinates. */
export interface MiniMapMaskState {
    readonly view: { x: number; y: number; width: number; height: number };
}

export interface MiniMapMaskProps
    extends SvgPrimitiveProps<MiniMapMaskState, SVGPathElement> {}

/**
 * The `MiniMap`'s mask (`data-flow-part="minimap-mask"`): an SVG path covering the map but what the
 * root shows (`fill-rule="evenodd"`). Give it its fill.
 */
export function MiniMapMask(props: MiniMapMaskProps) {
    const view = useMiniMapView("MiniMapMask");
    return useRenderElement("path", props, {
        state: { view: view.view },
        props: {
            ...partAttributes("minimap-mask"),
            d: view.maskPath,
            fillRule: "evenodd",
        },
    });
}
