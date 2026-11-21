import type { MinimapView } from "@fragiola/flow";
import * as React from "react";

/** The view of the enclosing `MiniMap`, for its nodes and its mask. */
export const MiniMapContext = React.createContext<MinimapView | null>(null);

export function useMiniMapView(part: string): MinimapView {
    const view = React.useContext(MiniMapContext);
    if (!view) throw new Error(`${part} must be rendered inside MiniMap`);
    return view;
}
