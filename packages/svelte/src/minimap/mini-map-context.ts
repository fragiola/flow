import type { MinimapView } from "@fragiola/flow";
import { getContext, hasContext, setContext } from "svelte";

/** The view of the enclosing `MiniMap`, for its nodes and its mask (a getter). */
export interface MiniMapContextValue {
    readonly view: MinimapView;
}

const MINIMAP = Symbol("FlowMiniMap");

export function setMiniMapContext(value: MiniMapContextValue): void {
    setContext(MINIMAP, value);
}

export function useMiniMapContext(part: string): MiniMapContextValue {
    const context = hasContext(MINIMAP)
        ? getContext<MiniMapContextValue>(MINIMAP)
        : undefined;
    if (!context) throw new Error(`${part} must be rendered inside MiniMap`);
    return context;
}
