import { computed, Directive, type Signal } from "@angular/core";
import { type MinimapView, partAttributes } from "@fragiola/flow";
import {
    ɵbindAttributes as bindAttributes,
    ɵbindBaseAttributes as bindBaseAttributes,
    ɵinjectHost as injectHost,
} from "@fragiola/flow-angular";
import { injectMiniMapView } from "./mini-map-context";

/** The state of `[flowMiniMapMask]`: the root's view, in flow coordinates. */
export interface MiniMapMaskState {
    readonly view: { x: number; y: number; width: number; height: number };
}

const ATTRIBUTES = partAttributes("minimap-mask");

/** @internal binds a minimap's mask onto `element` */
export function bindMiniMapMask(
    element: Element,
    view: Signal<MinimapView>,
): void {
    bindAttributes(element, () => ATTRIBUTES);
    // the app's own `fill-rule` (or `d`) wins
    bindBaseAttributes(element, () => ({
        d: view().maskPath,
        "fill-rule": "evenodd",
    }));
}

/**
 * The minimap's mask (`data-flow-part="minimap-mask"`), on the app's SVG path inside
 * `[flowMiniMap]`: `<svg:path flowMiniMapMask />`, covering the map but what the root shows
 * (`fill-rule="evenodd"`). Give it its fill.
 */
@Directive({ selector: "[flowMiniMapMask]", exportAs: "flowMiniMapMask" })
export class FlowMiniMapMaskDirective {
    private readonly view = injectMiniMapView("[flowMiniMapMask]");

    /** the mask's state */
    readonly state: Signal<MiniMapMaskState> = computed(() => ({
        view: this.view().view,
    }));

    constructor() {
        bindMiniMapMask(injectHost<SVGElement>(), this.view);
    }
}
