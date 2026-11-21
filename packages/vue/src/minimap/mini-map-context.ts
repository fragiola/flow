import type { MinimapView } from "@fragiola/flow";
import { type ComputedRef, inject } from "vue";
import { MiniMapKey } from "../context";

/** The view of the enclosing `MiniMap`, for its nodes and its mask. */
export function useMiniMapView(part: string): ComputedRef<MinimapView> {
    const view = inject(MiniMapKey, null);
    if (!view) throw new Error(`${part} must be rendered inside MiniMap`);
    return view;
}
