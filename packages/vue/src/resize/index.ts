// The entry of @fragiola/flow-vue/resize: the core's resize feature (`resize()`) and what
// draws it: `NodeResizer`, `ResizeHandle`. A flow that never imports it does not ship them.

export * from "@fragiola/flow/resize";
export {
    NodeResizer,
    type NodeResizerProps,
    type NodeResizerSlots,
    type NodeResizerState,
} from "./node-resizer";
export {
    RESIZE_POSITIONS,
    ResizeHandle,
    type ResizeHandleProps,
    type ResizeHandleSlots,
    type ResizeHandleState,
    type ResizePosition,
} from "./resize-handle";
