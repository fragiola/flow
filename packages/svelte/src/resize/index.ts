// The entry of @fragiola/flow-svelte/resize: the core's resize feature (`resize()`) and what
// draws it: `NodeResizer`, `ResizeHandle`. A flow that never imports it does not ship them.

export * from "@fragiola/flow/resize";
export {
    default as NodeResizer,
    type NodeResizerProps,
    type NodeResizerState,
} from "./node-resizer.svelte";
export {
    default as ResizeHandle,
    RESIZE_POSITIONS,
    type ResizeHandleProps,
    type ResizeHandleState,
    type ResizePosition,
} from "./resize-handle.svelte";
