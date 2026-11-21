// The entry of @fragiola/flow-angular/resize: the core's resize feature (`resize()`) and what
// draws it: `[flowNodeResizer]`, `[flowResizeHandle]` (`FLOW_RESIZE`). A flow that never imports
// it does not ship them.
import { FlowNodeResizerDirective } from "./node-resizer.directive";
import { FlowResizeHandleDirective } from "./resize-handle.directive";

export * from "@fragiola/flow/resize";
export {
    FlowNodeResizerDirective,
    type NodeResizerState,
} from "./node-resizer.directive";
export {
    FlowResizeHandleDirective,
    RESIZE_POSITIONS,
    type ResizeHandleState,
    type ResizePosition,
} from "./resize-handle.directive";

/** The resizer's directives, for a standalone component's `imports`. */
export const FLOW_RESIZE = [
    FlowNodeResizerDirective,
    FlowResizeHandleDirective,
] as const;
