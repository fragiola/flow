// The entry of @fragiola/flow-react/minimap: the core's minimap feature (`minimap()`) and what
// draws it: `MiniMap`, `MiniMapNode`, `MiniMapMask`. A flow that never imports it does not ship
// them.

export * from "@fragiola/flow/minimap";
export {
    MiniMap,
    type MiniMapProps,
    type MiniMapState,
} from "./mini-map";
export {
    MiniMapMask,
    type MiniMapMaskProps,
    type MiniMapMaskState,
} from "./mini-map-mask";
export {
    MiniMapNode,
    type MiniMapNodeProps,
    type MiniMapNodeState,
} from "./mini-map-node";
