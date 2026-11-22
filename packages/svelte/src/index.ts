// @fragiola/flow-svelte: the Flow primitives and runes over the core. The whole core is
// re-exported, so that a Svelte app installs and imports one package; a local export would
// silently shadow a core name of the same spelling (tests/index.test.ts fails on one). The
// features are on their own entries (`@fragiola/flow-svelte/<feature>`), never imported here.
export * from "@fragiola/flow";
export type {
    BackgroundProps,
    BackgroundState,
} from "./components/background.svelte";
export type {
    ConnectionLineProps,
    ConnectionLineState,
} from "./components/connection-line.svelte";
export type {
    ControlsProps,
    ControlsState,
} from "./components/controls.svelte";
export type { EdgeProps } from "./components/edge.svelte";
export type {
    EdgeLabelProps,
    EdgeLabelState,
} from "./components/edge-label.svelte";
export type {
    EdgePathProps,
    EdgePathState,
} from "./components/edge-path.svelte";
export type {
    EdgeToolbarProps,
    EdgeToolbarState,
} from "./components/edge-toolbar.svelte";
export type { EdgesProps, EdgesState } from "./components/edges.svelte";
export type { FitViewProps } from "./components/fit-view.svelte";
export type { HandleProps } from "./components/handle.svelte";
export type { NodeProps } from "./components/node.svelte";
export type {
    NodeToolbarProps,
    NodeToolbarState,
} from "./components/node-toolbar.svelte";
export type { NodesProps, NodesState } from "./components/nodes.svelte";
export type {
    ReconnectAnchorProps,
    ReconnectAnchorState,
} from "./components/reconnect-anchor.svelte";
export type {
    RootEngineProps,
    RootProps,
    RootState,
} from "./components/root.svelte";
export type {
    SelectionBoxProps,
    SelectionBoxState,
} from "./components/selection-box.svelte";
export type {
    ToggleInteractiveProps,
    ToggleInteractiveState,
} from "./components/toggle-interactive.svelte";
export type {
    ViewportProps,
    ViewportState,
} from "./components/viewport.svelte";
export type { ZoomInProps } from "./components/zoom-in.svelte";
export type { ZoomOutProps } from "./components/zoom-out.svelte";
export * as Flow from "./parts.js";
export {
    createFlowRef,
    type FlowRef,
    type FlowRefValue,
} from "./runes/create-flow-ref.svelte.js";
export type { FlowValue, MaybeGetter } from "./runes/internal.svelte.js";
export { useConnection } from "./runes/use-connection.svelte.js";
export type { ControlButtonState } from "./runes/use-control-button.svelte.js";
export {
    type EdgeElementProps,
    type EdgeState,
    type UseEdgeResult,
    useEdge,
} from "./runes/use-edge.svelte.js";
export { useEdges } from "./runes/use-edges.svelte.js";
export { type UseFlowResult, useFlow } from "./runes/use-flow.svelte.js";
export { useFlowRef } from "./runes/use-flow-ref.svelte.js";
export {
    type HandleElementProps,
    type HandleState,
    type UseHandleOptions,
    type UseHandleResult,
    useHandle,
} from "./runes/use-handle.svelte.js";
export {
    type NodeElementProps,
    type NodeState,
    type UseNodeResult,
    useNode,
} from "./runes/use-node.svelte.js";
export { useNodes } from "./runes/use-nodes.svelte.js";
export {
    type FlowSelection,
    useSelection,
} from "./runes/use-selection.svelte.js";
export { useViewport } from "./runes/use-viewport.svelte.js";
export { type TypedFlow, typedFlow } from "./typed.js";
export type {
    ButtonPrimitiveProps,
    DivPrimitiveProps,
    ElementPrimitiveProps,
    PrimitiveProps,
    RenderedProps,
    RenderSnippet,
    RenderSnippetProps,
    StyleValue,
    SvgPrimitiveProps,
} from "./utils/render.js";
