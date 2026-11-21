import { InjectionToken, inject, type Signal } from "@angular/core";
import type { MinimapView } from "@fragiola/flow";

/** The view of the enclosing `[flowMiniMap]`, for its nodes and its mask. */
export const FLOW_MINIMAP_VIEW = new InjectionToken<Signal<MinimapView>>(
    "FlowMiniMapView",
);

export function injectMiniMapView(part: string): Signal<MinimapView> {
    const view = inject(FLOW_MINIMAP_VIEW, { optional: true });
    if (!view) throw new Error(`${part} must be used inside [flowMiniMap]`);
    return view;
}
