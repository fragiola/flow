// What the engine tells the app (D12): every step a screen user would want announced (a node
// moved, an edge connected, a selection removed) and every viewport change. No text is built in:
// the app turns an event into its own words for its own live region, or syncs a controlled
// viewport from it.

import type { XY } from "../document/types";
import type { Viewport } from "../geometry/types";
import type { HandleType } from "../state/queries";

/** How a move, a connection or a resize was made: with the pointer or with the keyboard. */
export type MoveSource = "pointer" | "keyboard";

/** A handle a connection's events name: its node, its id and its type. */
export interface ConnectionEnd {
    readonly nodeId: string;
    readonly handleId: string | undefined;
    readonly type: HandleType;
}

/**
 * Where a connection or a reconnection ended without an edge: the handle it came from (`from`;
 * for a reconnection, the edge's fixed end), the handle it was over (`to`, none when it was over
 * nothing), and the drop point as a client point (`clientX`, `clientY`: a new node goes there) and
 * as a flow point. A keyboard connection's points are its target's (or its start's) centre.
 * `dropped` tells a release (or a keyboard confirm) from a cancel (Escape, the lock turning
 * `connect` off, a `pointercancel`): only a drop should add a node where it ended.
 */
export interface ConnectionDrop {
    readonly dropped: boolean;
    readonly from: ConnectionEnd;
    readonly to: ConnectionEnd | undefined;
    readonly client: XY;
    readonly point: XY;
}

/**
 * Where a tap, a double click or a context menu happened: the flow point and the client point,
 * and the DOM event (an app prevents a context menu's default with it).
 */
export interface FlowPointerInfo {
    /** the flow point */
    readonly point: XY;
    /** the client point (`clientX`, `clientY`) */
    readonly client: XY;
    /** the event that ended it: the tap's `pointerup`, the `dblclick`, the `contextmenu` */
    readonly event: MouseEvent;
}

/** A step of a drag of the rectangle around the selection: the dragged nodes and the pointer. */
export interface SelectionDragStep {
    /** the nodes it drags (the selection's draggable ones) */
    readonly nodeIds: readonly string[];
    /** the pointer's client point (`clientX`, `clientY`) */
    readonly client: XY;
    /** the pointer's flow point */
    readonly point: XY;
}

/** A viewport change of a gesture or an animation, at its start or its end. */
interface ViewportMove {
    readonly viewport: Viewport;
    /** a pan, a zoom, a pinch or auto-pan (`true`), or an action (`false`) */
    readonly gesture: boolean;
}

/** An event of `engine.subscribe`. */
export type FlowEngineEvent =
    | {
          /** the viewport changed (`gesture`: by a pan, a zoom or a pinch, not by an action) */
          readonly type: "viewport-change";
          readonly viewport: Viewport;
          readonly gesture: boolean;
      }
    | ({
          /**
           * the viewport starts changing: the first change of a pan, a wheel, a pinch, an
           * animation or an action (an action that does not animate starts and ends at once)
           */
          readonly type: "viewport-change-start";
      } & ViewportMove)
    | ({
          /**
           * the viewport stopped changing: the pan or pinch was released, the animation ended or
           * stopped, the wheel rested for 150 ms
           */
          readonly type: "viewport-change-end";
      } & ViewportMove)
    | {
          /** the root has a size and the fit on init (`fitView`) is done, once per engine */
          readonly type: "ready";
      }
    | ({
          /** a tap (a press released within the tap distance, no gesture started) on a node */
          readonly type: "node-click";
          readonly nodeId: string;
      } & FlowPointerInfo)
    | ({
          /** a tap on an edge */
          readonly type: "edge-click";
          readonly edgeId: string;
      } & FlowPointerInfo)
    | ({
          /** a tap on the pane */
          readonly type: "pane-click";
      } & FlowPointerInfo)
    | ({
          /**
           * a tap on a minimap (`minimap()`): `point` is the flow point under it on the minimap
           * (`minimap-point-to-flow`), not the one behind it in the root; `element` is the
           * tapped minimap (its `data-flow-part="minimap"` element), as an app may draw several
           */
          readonly type: "minimap-click";
          readonly element: Element;
      } & FlowPointerInfo)
    | ({
          /** a double click whose two presses were taps on a node */
          readonly type: "node-double-click";
          readonly nodeId: string;
      } & FlowPointerInfo)
    | ({
          /** a double click whose two presses were taps on an edge */
          readonly type: "edge-double-click";
          readonly edgeId: string;
      } & FlowPointerInfo)
    | ({
          /** a double click whose two presses were taps on the pane */
          readonly type: "pane-double-click";
      } & FlowPointerInfo)
    | ({
          /** a context menu on a node (not one of several selected nodes) */
          readonly type: "node-context-menu";
          readonly nodeId: string;
      } & FlowPointerInfo)
    | ({
          /** a context menu on an edge */
          readonly type: "edge-context-menu";
          readonly edgeId: string;
      } & FlowPointerInfo)
    | ({
          /** a context menu on the pane */
          readonly type: "pane-context-menu";
      } & FlowPointerInfo)
    | ({
          /**
           * a context menu on a selected node while several nodes are selected, or on the
           * rectangle around the selection (the `nodes-selection` part): the selection's
           */
          readonly type: "selection-context-menu";
          readonly nodeIds: readonly string[];
          readonly edgeIds: readonly string[];
      } & FlowPointerInfo)
    | {
          /** a drag of these nodes started (`drag()`) */
          readonly type: "drag-start";
          readonly nodeIds: readonly string[];
      }
    | {
          /** nodes were moved and dropped (a drag) or moved by the arrows (`keyboard()`) */
          readonly type: "nodes-move";
          readonly nodeIds: readonly string[];
          readonly source: MoveSource;
      }
    | ({
          /**
           * a drag of the rectangle around the selection (the `nodes-selection` part, `drag()`)
           * started (instead of `drag-start`): its nodes, where the pointer is
           */
          readonly type: "selection-drag-start";
      } & SelectionDragStep)
    | ({
          /** the rectangle's drag moved its nodes (each step, auto-pan's included) */
          readonly type: "selection-drag";
      } & SelectionDragStep)
    | ({
          /** the rectangle's drag dropped its nodes (after their `nodes-move`) */
          readonly type: "selection-drag-end";
      } & SelectionDragStep)
    | {
          /** a drag was cancelled: its nodes went back */
          readonly type: "drag-cancel";
          readonly nodeIds: readonly string[];
      }
    | {
          /**
           * a connection started from a handle (`connection()`): dragged or tapped (`input:
           * "pointer"`), or Enter on a focused handle (`"keyboard"`, with `keyboard()`)
           */
          readonly type: "connect-start";
          readonly nodeId: string;
          readonly handleId: string | undefined;
          readonly handleType: HandleType;
          readonly input: MoveSource;
      }
    | {
          /**
           * a keyboard connection points at another target handle (the arrows, Tab): the
           * `index`-th of the `count` handles the model accepts, nearest first (`index` -1 and no
           * handle when it accepts none), for the app's live region
           */
          readonly type: "connect-target";
          readonly nodeId: string | undefined;
          readonly handleId: string | undefined;
          readonly handleType: HandleType | undefined;
          readonly index: number;
          readonly count: number;
      }
    | {
          /** a connection was dropped on a handle (or Enter chose it): an edge was added (`edge.add`) */
          readonly type: "connect";
          readonly edgeId: string;
          readonly source: string;
          readonly target: string;
          readonly input: MoveSource;
      }
    | ({
          /**
           * a connection ended without an edge: dropped nowhere, cancelled, or (`refused`) on a
           * handle `model.can("edge.add", …)` refused; where it ended (`ConnectionDrop`)
           */
          readonly type: "connect-cancel";
          readonly refused: boolean;
          readonly input: MoveSource;
      } & ConnectionDrop)
    | {
          /** an edge's end was dragged (`reconnection()`) */
          readonly type: "reconnect-start";
          readonly edgeId: string;
          readonly end: "source" | "target";
      }
    | {
          /** an edge was reconnected (`edge.reconnect`) */
          readonly type: "reconnect";
          readonly edgeId: string;
          readonly source: string;
          readonly target: string;
      }
    | ({
          /**
           * a reconnection ended with the edge as it was (`refused`: dropped on a refused handle);
           * `from` is the edge's fixed end, `to` the handle it was over
           */
          readonly type: "reconnect-cancel";
          readonly edgeId: string;
          readonly end: "source" | "target";
          readonly refused: boolean;
      } & ConnectionDrop)
    | {
          /** a resize of a node started (`resize()`, a drag of a resize handle past its press) */
          readonly type: "resize-start";
          readonly nodeId: string;
          readonly width: number;
          readonly height: number;
      }
    | {
          /** a resize was cancelled: the node is back at its size */
          readonly type: "resize-cancel";
          readonly nodeId: string;
      }
    | {
          /** a node was resized (`resize()`): by a drag, or by the arrows on a focused resize handle */
          readonly type: "resize";
          readonly nodeId: string;
          readonly width: number;
          readonly height: number;
          readonly source: MoveSource;
      }
    | {
          /** a selection box started (`selection()`): the pointer moved past its press */
          readonly type: "box-select-start";
          /** where it started, as a client point and as a flow point */
          readonly client: XY;
          readonly point: XY;
      }
    | {
          /** a box selection ended with these selected (`selection()`) */
          readonly type: "box-select";
          readonly nodeIds: readonly string[];
          readonly edgeIds: readonly string[];
      }
    | {
          /** a delete key removed these (`keyboard()`, after its `beforeDelete`) */
          readonly type: "remove";
          readonly nodeIds: readonly string[];
          readonly edgeIds: readonly string[];
      };

/** The type of an engine event. */
export type FlowEngineEventType = FlowEngineEvent["type"];

/** The event of a type. */
export type FlowEngineEventOf<K extends FlowEngineEventType> = Extract<
    FlowEngineEvent,
    { readonly type: K }
>;
