// @fragiola/flow-vue: the Flow primitives and composables over the core. The whole core is
// re-exported, so that a Vue app installs and imports one package; a local export would silently
// shadow a core name of the same spelling (tests/index.test.ts fails on one). The features are on
// their own entries (`@fragiola/flow-vue/<feature>`), never imported here.
export * from "@fragiola/flow";
export type {
    BackgroundProps,
    BackgroundSlots,
    BackgroundState,
} from "./components/background";
export type {
    ConnectionLineProps,
    ConnectionLineSlots,
    ConnectionLineState,
} from "./components/connection-line";
export type {
    ControlsProps,
    ControlsSlots,
    ControlsState,
} from "./components/controls";
export type { EdgeProps, EdgeSlots } from "./components/edge";
export type {
    EdgeLabelProps,
    EdgeLabelSlots,
    EdgeLabelState,
} from "./components/edge-label";
export type {
    EdgePathProps,
    EdgePathSlots,
    EdgePathState,
} from "./components/edge-path";
export type {
    EdgeToolbarProps,
    EdgeToolbarSlots,
    EdgeToolbarState,
} from "./components/edge-toolbar";
export type { EdgesProps, EdgesSlots, EdgesState } from "./components/edges";
export type { FitViewProps, FitViewSlots } from "./components/fit-view";
export type { HandleProps, HandleSlots } from "./components/handle";
export type { NodeProps, NodeSlots } from "./components/node";
export type {
    NodeToolbarProps,
    NodeToolbarSlots,
    NodeToolbarState,
} from "./components/node-toolbar";
export type { NodesProps, NodesSlots, NodesState } from "./components/nodes";
export type {
    ReconnectAnchorProps,
    ReconnectAnchorSlots,
    ReconnectAnchorState,
} from "./components/reconnect-anchor";
export type {
    RootEmits,
    RootEngineProps,
    RootEventEmits,
    RootProps,
    RootSlots,
    RootState,
} from "./components/root";
export type {
    SelectionBoxProps,
    SelectionBoxSlots,
    SelectionBoxState,
} from "./components/selection-box";
export type {
    ToggleInteractiveProps,
    ToggleInteractiveSlots,
    ToggleInteractiveState,
} from "./components/toggle-interactive";
export type {
    ViewportProps,
    ViewportSlots,
    ViewportState,
} from "./components/viewport";
export type { ZoomInProps, ZoomInSlots } from "./components/zoom-in";
export type { ZoomOutProps, ZoomOutSlots } from "./components/zoom-out";
export {
    createFlowRef,
    type FlowRef,
    type FlowRefValue,
} from "./composables/create-flow-ref";
export { useConnection } from "./composables/use-connection";
export type { ControlButtonState } from "./composables/use-control-button";
export {
    type EdgeElementProps,
    type EdgeState,
    type UseEdgeResult,
    useEdge,
} from "./composables/use-edge";
export { useEdges } from "./composables/use-edges";
export { type UseFlowResult, useFlow } from "./composables/use-flow";
export { useFlowRef } from "./composables/use-flow-ref";
export {
    type HandleElementProps,
    type HandleState,
    type UseHandleOptions,
    type UseHandleResult,
    useHandle,
} from "./composables/use-handle";
export {
    type NodeElementProps,
    type NodeState,
    type UseNodeResult,
    useNode,
} from "./composables/use-node";
export { useNodes } from "./composables/use-nodes";
export { type FlowSelection, useSelection } from "./composables/use-selection";
export { useViewport } from "./composables/use-viewport";
export * as Flow from "./parts";
export { type TypedFlow, typedFlow } from "./typed";
export type {
    FlowComponent,
    PrimitiveProps,
    SlotFunction,
} from "./utils/primitive";
export type {
    AsProp,
    ElementRef,
    RenderSlot,
    RenderSlotProps,
} from "./utils/render";
