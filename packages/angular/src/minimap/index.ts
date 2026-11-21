// The entry of @fragiola/flow-angular/minimap: the core's minimap feature (`minimap()`) and what
// draws it: `[flowMiniMap]`, `[flowMiniMapNode]`, `[flowMiniMapMask]` (`FLOW_MINIMAP`). A flow
// that never imports it does not ship them.
import { FlowMiniMapDirective } from "./mini-map.directive";
import { FlowMiniMapMaskDirective } from "./mini-map-mask.directive";
import { FlowMiniMapNodeDirective } from "./mini-map-node.directive";

export * from "@fragiola/flow/minimap";
export { FlowMiniMapDirective, type MiniMapState } from "./mini-map.directive";
export {
    FlowMiniMapMaskDirective,
    type MiniMapMaskState,
} from "./mini-map-mask.directive";
export {
    FlowMiniMapNodeDirective,
    type MiniMapNodeState,
} from "./mini-map-node.directive";

/** The minimap's directives, for a standalone component's `imports`. */
export const FLOW_MINIMAP = [
    FlowMiniMapDirective,
    FlowMiniMapNodeDirective,
    FlowMiniMapMaskDirective,
] as const;
