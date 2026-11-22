// The entry of @fragiola/flow-vue/minimap: the core's minimap feature (`minimap()`) and what
// draws it: `MiniMap`, `MiniMapNode`, `MiniMapMask`. A flow that never imports it does not ship
// them.

export * from "@fragiola/flow/minimap";
export {
    MiniMap,
    type MiniMapEmits,
    type MiniMapProps,
    type MiniMapSlots,
    type MiniMapState,
} from "./mini-map";
export {
    MiniMapMask,
    type MiniMapMaskProps,
    type MiniMapMaskSlots,
    type MiniMapMaskState,
} from "./mini-map-mask";
export {
    MiniMapNode,
    type MiniMapNodeProps,
    type MiniMapNodeSlots,
    type MiniMapNodeState,
} from "./mini-map-node";
