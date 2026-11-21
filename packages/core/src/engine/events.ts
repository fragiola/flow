// What the engine tells the app (D12): every step a screen user would want announced (a node
// moved, an edge connected, a selection removed) and every viewport change. No text is built in:
// the app turns an event into its own words for its own live region, or syncs a controlled
// viewport from it.

import type { Viewport } from "../geometry/types";
import type { HandleType } from "../state/queries";

/** How a move was made. */
export type MoveSource = "pointer" | "keyboard";

/** An event of `engine.subscribe`. */
export type FlowEngineEvent =
    | {
          /** the viewport changed (`gesture`: by a pan, a zoom or a pinch, not by an action) */
          readonly type: "viewport-change";
          readonly viewport: Viewport;
          readonly gesture: boolean;
      }
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
    | {
          /** a drag was cancelled: its nodes went back */
          readonly type: "drag-cancel";
          readonly nodeIds: readonly string[];
      }
    | {
          /** a connection started from a handle (`connection()`) */
          readonly type: "connect-start";
          readonly nodeId: string;
          readonly handleId: string | undefined;
          readonly handleType: HandleType;
      }
    | {
          /** a connection was dropped on a handle: an edge was added (`edge.add`) */
          readonly type: "connect";
          readonly edgeId: string;
          readonly source: string;
          readonly target: string;
      }
    | {
          /**
           * a connection ended without an edge: dropped nowhere, cancelled, or (`refused`) on a
           * handle `model.can("edge.add", …)` refused
           */
          readonly type: "connect-cancel";
          readonly refused: boolean;
      }
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
    | {
          /** a reconnection ended with the edge as it was (`refused`: dropped on a refused handle) */
          readonly type: "reconnect-cancel";
          readonly edgeId: string;
          readonly refused: boolean;
      }
    | {
          /** a node was resized (`resize()`) */
          readonly type: "resize";
          readonly nodeId: string;
          readonly width: number;
          readonly height: number;
      }
    | {
          /** a box selection ended with these selected (`selection()`) */
          readonly type: "box-select";
          readonly nodeIds: readonly string[];
          readonly edgeIds: readonly string[];
      }
    | {
          /** Delete or Backspace removed these (`keyboard()`) */
          readonly type: "remove";
          readonly nodeIds: readonly string[];
          readonly edgeIds: readonly string[];
      };

/** The type of an engine event. */
export type FlowEngineEventType = FlowEngineEvent["type"];
