// @fragiola/flow-react: the Flow primitives and hooks over the core. The whole core is
// re-exported, so that a React app installs and imports one package; a local export would
// silently shadow a core name of the same spelling (tests/index.test.ts fails on one). The
// features are on their own entries (`@fragiola/flow-react/<feature>`), never imported here.
export * from "@fragiola/flow";
export type {
    BackgroundProps,
    BackgroundState,
} from "./components/background";
export type {
    ConnectionLineProps,
    ConnectionLineState,
} from "./components/connection-line";
export type { ControlsProps, ControlsState } from "./components/controls";
export type { EdgeProps } from "./components/edge";
export type {
    EdgeLabelProps,
    EdgeLabelState,
} from "./components/edge-label";
export type { EdgePathProps, EdgePathState } from "./components/edge-path";
export type { EdgesProps, EdgesState } from "./components/edges";
export type { FitViewProps } from "./components/fit-view";
export type { HandleProps } from "./components/handle";
export type { NodeProps } from "./components/node";
export type {
    NodeToolbarProps,
    NodeToolbarState,
} from "./components/node-toolbar";
export type { NodesProps, NodesState } from "./components/nodes";
export type {
    ReconnectAnchorProps,
    ReconnectAnchorState,
} from "./components/reconnect-anchor";
export type {
    RootEngineProps,
    RootProps,
    RootState,
} from "./components/root";
export type {
    SelectionBoxProps,
    SelectionBoxState,
} from "./components/selection-box";
export type {
    ToggleInteractiveProps,
    ToggleInteractiveState,
} from "./components/toggle-interactive";
export type { ViewportProps, ViewportState } from "./components/viewport";
export type { ZoomInProps } from "./components/zoom-in";
export type { ZoomOutProps } from "./components/zoom-out";
export {
    createFlowRef,
    type FlowRef,
    type FlowRefValue,
} from "./hooks/create-flow-ref";
export { useConnection } from "./hooks/use-connection";
export type { ControlButtonState } from "./hooks/use-control-button";
export {
    type EdgeState,
    type UseEdgeResult,
    useEdge,
} from "./hooks/use-edge";
export { useEdges } from "./hooks/use-edges";
export { type UseFlowResult, useFlow } from "./hooks/use-flow";
export { useFlowRef } from "./hooks/use-flow-ref";
export {
    type HandleState,
    type UseHandleOptions,
    type UseHandleResult,
    useHandle,
} from "./hooks/use-handle";
export {
    type NodeState,
    type UseNodeResult,
    useNode,
} from "./hooks/use-node";
export { useNodes } from "./hooks/use-nodes";
export { type FlowSelection, useSelection } from "./hooks/use-selection";
export { useViewport } from "./hooks/use-viewport";
export * as Flow from "./parts";
export type {
    ButtonPrimitiveProps,
    DivPrimitiveProps,
    PrimitiveProps,
    RenderedProps,
    RenderProp,
    SvgPrimitiveProps,
} from "./utils/use-render";
