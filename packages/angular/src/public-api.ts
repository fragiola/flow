// @fragiola/flow-angular: composable, unstyled Angular directives over @fragiola/flow. The whole
// core is re-exported, so that an Angular app installs and imports one package; a local export
// would silently shadow a core name of the same spelling (tests/index.test.ts fails on one). The
// features are on their own entries (`@fragiola/flow-angular/<feature>`), never imported here.
export * from "@fragiola/flow";
// What the adapter's own feature entries (`/minimap`, `/resize`) build on: an entry imports another
// only through its public API. Not an app's API: the `ɵ` says so, as Angular's own.
export {
    type AnyFlowEngine as ɵAnyFlowEngine,
    type AnyFlowModel as ɵAnyFlowModel,
    type FlowContext as ɵFlowContext,
    injectFlowContext as ɵinjectFlowContext,
    injectNodeContext as ɵinjectNodeContext,
} from "./lib/context";
export {
    type BackgroundState,
    FlowBackgroundDirective,
} from "./lib/directives/background.directive";
export {
    type ConnectionLineState,
    FlowConnectionLineDirective,
} from "./lib/directives/connection-line.directive";
export {
    type ControlsState,
    FlowControlsDirective,
} from "./lib/directives/controls.directive";
export { FlowEdgeDirective } from "./lib/directives/edge.directive";
export {
    type EdgeLabelState,
    FlowEdgeLabelDirective,
} from "./lib/directives/edge-label.directive";
export {
    type EdgePathState,
    FlowEdgePathDirective,
} from "./lib/directives/edge-path.directive";
export {
    type EdgesItemContext,
    type EdgesState,
    FlowEdgesDirective,
    FlowEdgesItemDirective,
} from "./lib/directives/edges.directive";
export { FlowFitViewDirective } from "./lib/directives/fit-view.directive";
export { FlowHandleDirective } from "./lib/directives/handle.directive";
export { FlowNodeDirective } from "./lib/directives/node.directive";
export {
    FlowNodeToolbarDirective,
    type NodeToolbarState,
} from "./lib/directives/node-toolbar.directive";
export {
    FlowNodesDirective,
    FlowNodesItemDirective,
    type NodesItemContext,
    type NodesState,
    type TypedBy,
} from "./lib/directives/nodes.directive";
export {
    FlowReconnectAnchorDirective,
    type ReconnectAnchorState,
} from "./lib/directives/reconnect-anchor.directive";
export {
    FlowRootDirective,
    type RootEngineProps,
    type RootState,
    type ViewportMoveEvent,
} from "./lib/directives/root.directive";
export {
    FlowSelectionBoxDirective,
    type SelectionBoxState,
} from "./lib/directives/selection-box.directive";
export {
    FlowToggleInteractiveDirective,
    type ToggleInteractiveState,
} from "./lib/directives/toggle-interactive.directive";
export {
    FlowViewportDirective,
    type ViewportState,
} from "./lib/directives/viewport.directive";
export { FlowZoomInDirective } from "./lib/directives/zoom-in.directive";
export { FlowZoomOutDirective } from "./lib/directives/zoom-out.directive";
export { FLOW } from "./lib/flow";
export type { ControlButtonState } from "./lib/inject/control-button";
export {
    createFlowRef,
    type FlowRef,
    type FlowRefValue,
} from "./lib/inject/create-flow-ref";
export { injectConnection } from "./lib/inject/inject-connection";
export {
    type EdgeState,
    type InjectEdgeResult,
    injectEdge,
} from "./lib/inject/inject-edge";
export { injectEdges } from "./lib/inject/inject-edges";
export { type InjectFlowResult, injectFlow } from "./lib/inject/inject-flow";
export { injectFlowRef } from "./lib/inject/inject-flow-ref";
export {
    type HandleState,
    type InjectHandleOptions,
    type InjectHandleResult,
    injectHandle,
} from "./lib/inject/inject-handle";
export {
    type InjectNodeResult,
    injectNode,
    type NodeElementProps,
    type NodeState,
} from "./lib/inject/inject-node";
export { injectNodes } from "./lib/inject/inject-nodes";
export {
    type FlowSelection,
    injectSelection,
} from "./lib/inject/inject-selection";
export { injectViewport } from "./lib/inject/inject-viewport";
export {
    flowValue as ɵflowValue,
    partOwnerId as ɵpartOwnerId,
    type ValueOrSignal,
} from "./lib/inject/internal";
export { defaultContent as ɵdefaultContent } from "./lib/utils/default-content";
export {
    type AttributeRecord,
    beforeInputs as ɵbeforeInputs,
    bindAttributes as ɵbindAttributes,
    bindBaseAttributes as ɵbindBaseAttributes,
    bindStructuralStyle as ɵbindStructuralStyle,
    injectHost as ɵinjectHost,
    onDestroy as ɵonDestroy,
    optionalBoolean as ɵoptionalBoolean,
    optionalNumber as ɵoptionalNumber,
    px as ɵpx,
    type StructuralStyle,
} from "./lib/utils/helpers";
export { bindPresence as ɵbindPresence } from "./lib/utils/presence";
