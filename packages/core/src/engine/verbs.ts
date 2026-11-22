// The typed registry of the engine's keys (D13): what `engine.run`, `engine.get` and `engine.is`
// take and return. An engine action never has a dot, so it never reads as a command: commands
// change the flow through the model; actions are what only the screen can do (the viewport, DOM
// focus, a gesture). The features' keys are here too, answered by their engine sides
// (`FEATURE_KEYS` says whose they are).
import type {
    AnyTypes,
    FlowEdge,
    FlowNode,
    FlowTypes,
    XY,
} from "../document/types";
import type { EdgePath, HandleSide, Rect, Viewport } from "../geometry/types";
import type { NoPayload } from "../state/queries";
import type { FlowHandle } from "./adapter";

/** Options of `fit-view` (and of the `fitView` engine option). */
export interface FitViewPayload {
    /** the share of the root's size kept free on every side; default 0.1 */
    padding?: number | undefined;
    /** only these nodes; default every node that is not hidden */
    nodeIds?: string[] | undefined;
    /** the least zoom it may pick (within the engine's limits); default the engine's `minZoom` */
    minZoom?: number | undefined;
    /** the greatest zoom it may pick (within the engine's limits); default the engine's `maxZoom` */
    maxZoom?: number | undefined;
    /** how long it animates, in milliseconds (the engine's `easing`); default 0: at once */
    duration?: number | undefined;
}

/** What `viewport-for-bounds` takes: a flow rectangle and `fit-view`'s framing options. */
export interface ViewportForBoundsPayload {
    /** the flow rectangle to frame */
    bounds: Rect;
    /** the share of the root's size kept free on every side; default 0.1 */
    padding?: number | undefined;
    /** the least zoom it may pick (within the engine's limits); default the engine's `minZoom` */
    minZoom?: number | undefined;
    /** the greatest zoom it may pick (within the engine's limits); default the engine's `maxZoom` */
    maxZoom?: number | undefined;
}

/**
 * What `intersecting-nodes` takes: a node (its box) or a flow rectangle, and whether a node that
 * only overlaps it counts.
 */
export interface IntersectingNodesPayload {
    /** the node whose box the others are compared with (it is left out); wins over `rect` */
    nodeId?: string | undefined;
    /** a rectangle in absolute flow coordinates, without `nodeId` */
    rect?: Rect | undefined;
    /** any shared area counts (`true`, the default); `false`: only a node wholly inside */
    partial?: boolean | undefined;
}

/** A zoom by a step around a point (`zoom-in`, `zoom-out`). */
export interface ZoomStepPayload {
    /** the factor; default the engine's `zoomStep` (1.2) */
    step?: number | undefined;
    /** the screen point (relative to the root) that stays put; default the root's centre */
    around?: XY | undefined;
    /** how long it animates, in milliseconds (the engine's `easing`); default 0: at once */
    duration?: number | undefined;
}

/** The pattern a `Background` draws (`background-pattern`). */
export type BackgroundVariant = "dots" | "lines" | "cross";

/** What `background-pattern` takes. */
export interface BackgroundPatternPayload {
    /** default `"dots"` */
    variant?: BackgroundVariant | undefined;
    /** the distance between two marks, in flow units; default 20 (`[x, y]` for two) */
    gap?: number | readonly [number, number] | undefined;
    /**
     * dots: a dot's diameter, in flow units (default 1); lines: the stroke width, in screen pixels
     * (default 1); cross: the length of each bar, in flow units (default 6)
     */
    size?: number | undefined;
    /** the pattern's shift from the flow's origin, in flow units; default 0 */
    offset?: number | readonly [number, number] | undefined;
}

/**
 * One tile of a background pattern, on the screen: an SVG `<pattern>` with
 * `patternUnits="userSpaceOnUse"` at `x`, `y` of `width` × `height`, drawing a dot (`dot`) or a
 * path (`path`, for lines and crosses, stroked `strokeWidth`).
 */
export interface BackgroundPattern {
    readonly variant: BackgroundVariant;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    /** the dot (`dots`), inside the tile */
    readonly dot:
        | { readonly cx: number; readonly cy: number; readonly r: number }
        | undefined;
    /** the lines' or the cross's path data (`lines`, `cross`), inside the tile */
    readonly path: string | undefined;
    /** the stroke width of `path`, in pixels */
    readonly strokeWidth: number;
}

/** Where a node's toolbar goes (`node-toolbar-by`): beside one node, or beside several nodes' bounds. */
export interface NodeToolbarPayload {
    /** the node it stands beside (without `nodeIds`) */
    nodeId?: string | undefined;
    /** the nodes whose bounds it stands beside (their measured boxes); wins over `nodeId` when not empty */
    nodeIds?: readonly string[] | undefined;
    /** the node's side it stands on; default `"top"` */
    side?: HandleSide | undefined;
    /** where along that side; default `"center"` */
    align?: "start" | "center" | "end" | undefined;
    /** the gap between the node and the toolbar, in pixels; default 10 */
    offset?: number | undefined;
}

/**
 * A toolbar's anchor point on the screen (relative to the root, outside the zoom), and which point
 * of the toolbar goes there: `anchorX`, `anchorY` are shares of its own size (`0.5, 1`: its
 * bottom centre), for a `translate(-50%, -100%)`.
 */
export interface NodeToolbarPosition {
    readonly x: number;
    readonly y: number;
    readonly anchorX: number;
    readonly anchorY: number;
}

/** Where an edge's toolbar goes (`edge-toolbar-by`). */
export interface EdgeToolbarPayload {
    edgeId: string;
    /** the point of the edge it stands at: its label point (default), its source or its target end */
    position?: "label" | "source" | "target" | undefined;
    /** a screen offset from that point, in pixels; default `{ x: 0, y: 0 }` */
    offset?: XY | undefined;
}

/**
 * An edge toolbar's anchor on the screen (relative to the root, outside the zoom): the toolbar's
 * centre goes there (`anchorX`, `anchorY` are 0.5).
 */
export type EdgeToolbarPosition = NodeToolbarPosition;

/** The selection box (`selection-box`, `selection()`): on the screen, relative to the root. */
export type SelectionBox = Rect;

/** A connection being drawn (`connection`, `connection()`). */
export interface Connection {
    /** the handle it started from */
    readonly from: FlowHandle;
    /** where it starts, in flow coordinates (the handle's centre) */
    readonly fromPoint: XY;
    /** where the pointer is, or the centre of the handle it snapped to, in flow coordinates */
    readonly toPoint: XY;
    /** the side it enters by: the snapped handle's, or the one facing its start */
    readonly toSide: HandleSide;
    /** the handle within the radius it would end at, if any */
    readonly to: FlowHandle | undefined;
    /** `valid`: the drop adds an edge; `invalid`: `model.can` refuses it; null: no handle near */
    readonly status: "valid" | "invalid" | null;
    /** the connection line's path (bezier) and its middle */
    readonly path: string;
    /** the edge whose end is being moved (`reconnection()`), with the end */
    readonly reconnecting:
        | { readonly edgeId: string; readonly end: "source" | "target" }
        | undefined;
}

/** What the minimap draws (`minimap-view`, `minimap()`), in flow coordinates. */
export interface MinimapView {
    /** the SVG `viewBox`: the nodes and the view, fitted to the minimap's aspect */
    readonly viewBox: Rect;
    /** `viewBox` as the attribute writes it */
    readonly viewBoxAttribute: string;
    /** the flow units one minimap pixel stands for */
    readonly scale: number;
    /** each visible node's box */
    readonly nodes: readonly {
        readonly nodeId: string;
        readonly x: number;
        readonly y: number;
        readonly width: number;
        readonly height: number;
    }[];
    /** what the root shows */
    readonly view: Rect;
    /** the mask: the view box with the view cut out (`fill-rule="evenodd"`) */
    readonly maskPath: string;
}

/**
 * What `engine.run(action, payload)` does: each screen action's payload and result. A viewport
 * action with a `duration` returns the viewport it animates to (zoom limits and extent kept) and
 * gets there frame by frame (`viewport-change` with `gesture: false` each frame); another viewport
 * action, a pan or zoom gesture, `cancel-gesture` or `destroy` stops it where it is.
 */
export interface EngineActionMap {
    /** sets the viewport (what it leaves out stays), its zoom and extent kept */
    "set-viewport": {
        payload: {
            x?: number;
            y?: number;
            zoom?: number;
            /** how long it animates, in milliseconds; default 0: at once */
            duration?: number | undefined;
        };
        result: Viewport;
    };
    /** pans by a screen offset, in pixels */
    "pan-by": { payload: { x: number; y: number }; result: Viewport };
    /** zooms in by a step around a point; refused at the greatest zoom */
    "zoom-in": { payload: ZoomStepPayload; result: Viewport };
    /** zooms out by a step around a point; refused at the least zoom */
    "zoom-out": { payload: ZoomStepPayload; result: Viewport };
    /** zooms to a zoom around a point (default the root's centre) */
    "zoom-to": {
        payload: {
            zoom: number;
            around?: XY | undefined;
            /** how long it animates, in milliseconds; default 0: at once */
            duration?: number | undefined;
        };
        result: Viewport;
    };
    /** fits the nodes (or some) in the root; refused while none is measured or the root has no size */
    "fit-view": { payload: FitViewPayload; result: Viewport };
    /** centres a flow point in the root (at a zoom) */
    "center-on": {
        payload: {
            x: number;
            y: number;
            zoom?: number | undefined;
            /** how long it animates, in milliseconds; default 0: at once */
            duration?: number | undefined;
        };
        result: Viewport;
    };
    /** gives DOM focus to a node's element, panning it into view */
    "focus-node": { payload: { nodeId: string }; result: { nodeId: string } };
    /** lets the gestures and keys change the flow, or not (the Controls' toggle); pan and zoom stay */
    "set-interactive": {
        payload: { interactive: boolean };
        result: { interactive: boolean };
    };
    /**
     * cancels the gesture under way (what Escape does) and stops a viewport animation where it is;
     * refused when there is neither
     */
    "cancel-gesture": { payload: NoPayload; result: NoPayload };
}

export type EngineActionKey = keyof EngineActionMap;
export type EngineActionPayload<K extends EngineActionKey> =
    EngineActionMap[K]["payload"];
export type EngineActionResult<K extends EngineActionKey> =
    EngineActionMap[K]["result"];

/** What `engine.get(key, payload)` reads: facts of this flow on screen. */
export interface EngineGetMap<T extends FlowTypes = AnyTypes> {
    /** the viewport */
    viewport: { payload: NoPayload; result: Viewport };
    /** the root's size, in pixels */
    "root-size": {
        payload: NoPayload;
        result: { readonly width: number; readonly height: number };
    };
    /**
     * an edge's path, label point and ends (D9), once both its nodes have a size; a type that is
     * not built in gets the bezier path (its own primitive may draw another from the ends)
     */
    "edge-path-by": {
        payload: { edgeId: string };
        result: EdgePath | undefined;
    };
    /** a node's box in absolute flow coordinates (size 0 until measured or given) */
    "node-rect-by": { payload: { nodeId: string }; result: Rect | undefined };
    /** the box of the nodes (or some), with their measured sizes; none without a node */
    "nodes-bounds": {
        payload: { nodeIds?: string[] | undefined };
        result: Rect | undefined;
    };
    /**
     * the viewport that frames a flow rectangle in the root, as `fit-view` would set it (padding,
     * zoom limits and translate extent kept); undefined while the root has no size
     */
    "viewport-for-bounds": {
        payload: ViewportForBoundsPayload;
        result: Viewport | undefined;
    };
    /**
     * the nodes whose box (measured or given) shares some area with a node's box or a rectangle
     * (`partial: false`: lies wholly inside it), in the document's order; hidden nodes, nodes of
     * unknown size and the node itself are left out
     */
    "intersecting-nodes": {
        payload: IntersectingNodesPayload;
        result: readonly FlowNode<T>[];
    };
    /** a client point (a pointer's `clientX`, `clientY`) as a flow point */
    "screen-to-flow": { payload: XY; result: XY };
    /** a flow point as a client point */
    "flow-to-screen": { payload: XY; result: XY };
    /** the nodes in view, and those not measured yet (so they render and get measured) */
    "visible-nodes": { payload: NoPayload; result: readonly FlowNode<T>[] };
    /** the edges whose ends' box is in view */
    "visible-edges": { payload: NoPayload; result: readonly FlowEdge<T>[] };
    /**
     * the edges to draw, in drawing order: those shown whose nodes are measured (with
     * `onlyRenderVisible`, those in view), by `zIndex` (a selected one raised with
     * `elevateEdgesOnSelect`), the document's order among equals
     */
    "drawn-edges": { payload: NoPayload; result: readonly FlowEdge<T>[] };
    /**
     * a node's structural `z-index` among the nodes: its `zIndex` (a selected one raised with
     * `elevateNodesOnSelect`), always above its parent's
     */
    "node-z-index-by": { payload: { nodeId: string }; result: number };
    /** a node's registered handles, with their centres */
    "handles-by": {
        payload: { nodeId: string };
        result: readonly FlowHandle[];
    };
    /** one tile of a background pattern at the current viewport */
    "background-pattern": {
        payload: BackgroundPatternPayload;
        result: BackgroundPattern;
    };
    /**
     * where a node's toolbar goes, outside the zoom: beside a node, or beside several nodes'
     * bounds (`nodeIds`); undefined until one of them has a size
     */
    "node-toolbar-by": {
        payload: NodeToolbarPayload;
        result: NodeToolbarPosition | undefined;
    };
    /**
     * where an edge's toolbar goes, outside the zoom: at its label point or one of its ends, until
     * its path is drawn (undefined before)
     */
    "edge-toolbar-by": {
        payload: EdgeToolbarPayload;
        result: EdgeToolbarPosition | undefined;
    };
    /** the selection box being drawn, or null (`selection()`) */
    "selection-box": { payload: NoPayload; result: SelectionBox | null };
    /** the nodes being dragged (`drag()`) */
    "dragging-node-ids": { payload: NoPayload; result: readonly string[] };
    /** the connection being drawn, or null (`connection()`) */
    connection: { payload: NoPayload; result: Connection | null };
    /** what a minimap of `width` × `height` pixels draws (`minimap()`) */
    "minimap-view": {
        payload: { width: number; height: number };
        result: MinimapView;
    };
}

export type EngineGetKey = keyof EngineGetMap;
export type EngineGetPayload<K extends EngineGetKey> =
    EngineGetMap[K]["payload"];
export type EngineGetResult<
    T extends FlowTypes,
    K extends EngineGetKey,
> = EngineGetMap<T>[K]["result"];

/** What `engine.is(key, payload)` asks: each question's payload. */
export interface EngineIsMap {
    /** the gestures and keys may change the flow (`set-interactive`) */
    interactive: NoPayload;
    /** the viewport is being panned by a drag or a pinch */
    panning: NoPayload;
    /** a node's size is known (measured, or given by the document) */
    "node-measured": { nodeId: string };
    /** a box selection is being drawn (`selection()`) */
    "box-selecting": NoPayload;
    /** nodes are being dragged (`drag()`) */
    dragging: NoPayload;
    /** a node is being dragged (`drag()`) */
    "node-dragging": { nodeId: string };
    /** a node is being resized (`resize()`) */
    "node-resizing": { nodeId: string };
    /** a node is being resized (`resize()`) */
    resizing: NoPayload;
    /** a connection is being drawn (`connection()`) */
    connecting: NoPayload;
    /** an edge's end is being moved (`reconnection()`) */
    "edge-reconnecting": { edgeId: string };
    /** a node takes DOM focus (`tabindex="0"`, `keyboard()`) */
    "node-focusable": { nodeId: string };
    /** an edge takes DOM focus (`tabindex="0"`, `keyboard()`) */
    "edge-focusable": { edgeId: string };
}

export type EngineIsKey = keyof EngineIsMap;
export type EngineIsPayload<K extends EngineIsKey> = EngineIsMap[K];
