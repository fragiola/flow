// The entry of @fragiola/flow-svelte/minimap: the core's minimap feature (`minimap()`) and what
// draws it: `MiniMap`, `MiniMapNode`, `MiniMapMask`. A flow that never imports it does not ship
// them.

export * from "@fragiola/flow/minimap";
export {
    default as MiniMap,
    type MiniMapProps,
    type MiniMapState,
} from "./mini-map.svelte";
export {
    default as MiniMapMask,
    type MiniMapMaskProps,
    type MiniMapMaskState,
} from "./mini-map-mask.svelte";
export {
    default as MiniMapNode,
    type MiniMapNodeProps,
    type MiniMapNodeState,
} from "./mini-map-node.svelte";
