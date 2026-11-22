// The name each engine event has as a root callback in every adapter (#33), so the four adapters
// cannot drift: React's `onNodeClick`, Svelte's `onnodeclick`, Vue's `@node-click`, Angular's
// `(nodeClick)` all come from `NodeClick`. The names follow React Flow's callbacks where it has
// one (`onMoveStart`, `onInit`, `onSelectionStart`, `onDelete`); `viewport-change` has its own
// callback (`onViewportChange(viewport, gesture)`) and is not here.
import type { FlowEngineEventType } from "./events";

/** The engine events a root calls back, each with its callback's name (after `on`). */
export const ENGINE_EVENT_CALLBACKS = Object.freeze({
    "viewport-change-start": "MoveStart",
    "viewport-change-end": "MoveEnd",
    ready: "Init",
    "node-click": "NodeClick",
    "node-double-click": "NodeDoubleClick",
    "node-context-menu": "NodeContextMenu",
    "edge-click": "EdgeClick",
    "edge-double-click": "EdgeDoubleClick",
    "edge-context-menu": "EdgeContextMenu",
    "pane-click": "PaneClick",
    "pane-double-click": "PaneDoubleClick",
    "pane-context-menu": "PaneContextMenu",
    "selection-context-menu": "SelectionContextMenu",
    "box-select-start": "SelectionStart",
    "box-select": "SelectionEnd",
    "drag-start": "NodeDragStart",
    "nodes-move": "NodesMove",
    "drag-cancel": "NodeDragCancel",
    "connect-start": "ConnectStart",
    "connect-target": "ConnectTarget",
    connect: "Connect",
    "connect-cancel": "ConnectCancel",
    "reconnect-start": "ReconnectStart",
    reconnect: "Reconnect",
    "reconnect-cancel": "ReconnectCancel",
    "resize-start": "ResizeStart",
    resize: "ResizeEnd",
    "resize-cancel": "ResizeCancel",
    remove: "Delete",
} as const satisfies Record<
    Exclude<FlowEngineEventType, "viewport-change">,
    string
>);

/** An engine event a root calls back. */
export type CallbackEventType = keyof typeof ENGINE_EVENT_CALLBACKS;

/** A callback's name after `on` (`NodeClick`). */
export type EventCallbackName =
    (typeof ENGINE_EVENT_CALLBACKS)[CallbackEventType];
