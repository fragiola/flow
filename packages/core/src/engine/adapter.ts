// What only an adapter (React, Vue, Svelte, Angular) calls on an engine (D13): the elements it
// renders, the handles it registers (D8), the attributes it spreads (D11) and the view changes it
// re-renders from. An app never needs it: it uses `run`, `can`, `check`, `get`, `is` and
// `subscribe`. The adapter renders and attaches; the engine listens to the root's events itself
// (Pointer Events with capture, the wheel, keys, focus) and decides.
import type { PartAttributes } from "../attributes/part-attributes";
import type { XY } from "../document/types";
import type { HandleSide, Rect } from "../geometry/types";
import type { FlowModel } from "../model/create-flow-model";
import type { HandleType } from "../state/queries";
import type { FlowEngineOptions } from "./create-flow-engine";

/** A handle as its primitive registers it (D8). */
export interface HandleRegistration {
    /** the node it belongs to */
    readonly nodeId: string;
    /** its id among the node's handles of its type (none: the node's default handle) */
    readonly handleId?: string | undefined;
    /** whether edges start (`source`) or end (`target`) at it */
    readonly type: HandleType;
    /** the side of the node it sits on: the direction an edge leaves or enters by */
    readonly side: HandleSide;
    /** whether a connection may start or end at it; default true */
    readonly connectable?: boolean | undefined;
    /** whether a connection may start at it (a drag, a tap, a key); default true */
    readonly connectableStart?: boolean | undefined;
    /** whether a connection may end at it (be its target); default true */
    readonly connectableEnd?: boolean | undefined;
}

/** A registered handle and where it is. */
export interface FlowHandle {
    readonly nodeId: string;
    readonly handleId: string | undefined;
    readonly type: HandleType;
    readonly side: HandleSide;
    readonly connectable: boolean;
    /** a connection may start at it (and it is `connectable`) */
    readonly connectableStart: boolean;
    /** a connection may end at it (and it is `connectable`) */
    readonly connectableEnd: boolean;
    /** its centre in absolute flow coordinates, once it and its node are measured */
    readonly center: XY | undefined;
    /** its box relative to its node's top-left corner, in flow units, once measured */
    readonly bounds: Rect | undefined;
}

/** What a press, a key, the wheel or focus hit in the flow, read from the part attributes. */
export interface PressTarget {
    /**
     * - `pane`: the flow's background (the root, the viewport, the background, the nodes' and
     *   edges' layers);
     * - `node`, `edge`, `handle`, `resize-handle`, `minimap`: that part (or an element inside it);
     *   a reconnect anchor is its edge's, with its `end`;
     * - `nodes-selection`: the rectangle around the selected nodes (`selection-rect`): a press
     *   drags the selection, a context menu is the selection's;
     * - `other`: a part with its own behaviour (the controls, a toolbar, a panel) or a control
     *   inside a node (a field, a button, `data-flow-no-gesture`): the flow leaves it alone
     */
    readonly kind:
        | "pane"
        | "node"
        | "edge"
        | "handle"
        | "resize-handle"
        | "minimap"
        | "nodes-selection"
        | "other";
    /** the part's element */
    readonly element: Element | undefined;
    /** the node it is in (a node, a handle, a resize handle) */
    readonly nodeId?: string | undefined;
    /** the edge (an edge, its path or its label) */
    readonly edgeId?: string | undefined;
    /** the handle */
    readonly handle?: FlowHandle | undefined;
    /** a resize handle's corner or side (`data-position`: `top-left`, `top`, …) */
    readonly position?: string | undefined;
    /** a reconnect anchor's end of its edge (`data-end`) */
    readonly end?: "source" | "target" | undefined;
    /**
     * a press on a node that holds a drag handle (`data-flow-drag-handle`), outside it: the node
     * is not dragged from there
     */
    readonly outsideDragHandle?: boolean | undefined;
}

/** What changed in the view, for an adapter to re-render only what depends on it. */
export interface ViewChange {
    /** the viewport moved or zoomed (the background, the minimap, toolbars) */
    readonly viewport: boolean;
    /** a node or handle was measured (edges, the minimap, toolbars) */
    readonly measured: boolean;
    /** a gesture's state changed (the connection line, the selection box, state attributes) */
    readonly gesture: boolean;
}

/** The payload each part's attributes take (`engine.adapter.attributes(part, payload)`). */
export interface PartPayloadMap {
    node: { nodeId: string };
    edge: { edgeId: string };
    "edge-path": { edgeId: string };
    "edge-label": { edgeId: string };
    "reconnect-anchor": { edgeId: string; end: "source" | "target" };
    handle: HandleRegistration;
    "resize-handle": { nodeId: string; position: string };
    resizer: { nodeId: string };
    "minimap-node": { nodeId: string };
    /** one render level's edges layer (`render-layers`) */
    "edges-layer": { level: number };
    /** a node's toolbar (`nodeId`), several nodes' (neither: no id) or an edge's (`edgeId`) */
    toolbar: { nodeId?: string | undefined; edgeId?: string | undefined };
}

/** What only an adapter calls on an engine. */
export interface FlowEngineAdapter {
    /** the model this engine draws */
    readonly model: FlowModel;
    /** the adapter's rendering settings, from the engine's options */
    readonly settings: {
        /** render only the nodes and edges in view (`visible-nodes`, `visible-edges`) */
        readonly onlyRenderVisible: boolean;
    };
    /**
     * the engine's options changed (a root prop: `minZoom`, `panOnDrag`, `translateExtent`,
     * `pathOptions`, `interactive`, `autoPan`, `panActivationKey`, `zoomActivationKey`, `easing`,
     * …): they apply from now on, a gesture under way included;
     * `root`, `defaultViewport` and `fitView` are creation options and are ignored here
     */
    setOptions(options: Partial<FlowEngineOptions>): void;
    /**
     * attaches the root element (`Flow.Root`): the engine listens to its events and sets its
     * `touch-action: none`; another replaces it
     */
    attachRoot(element: HTMLElement): void;
    /** detaches the root, cancelling a gesture under way */
    detachRoot(): void;
    /**
     * attaches (or, with `null`, detaches) the viewport element: the engine writes its transform
     * (`transform`, `transform-origin`) directly, and the framework never renders it (D4)
     */
    attachViewport(element: HTMLElement | SVGElement | null): void;
    /** registers (or unregisters) a node's element: the engine measures it (`ResizeObserver`) */
    registerNode(nodeId: string, element: HTMLElement | null): void;
    /** registers (or, with `null`, unregisters) a handle's element (D8): the engine measures its centre */
    registerHandle(handle: HandleRegistration, element: Element | null): void;
    /** options a part's primitive takes (`resizer`: `minWidth`, …); `null` drops them */
    setPartOptions(
        part: string,
        id: string,
        options: Readonly<Record<string, unknown>> | null,
    ): void;
    /** a part's attributes (D11): `data-flow-part`, `data-flow-id` and its state */
    attributes<P extends string>(
        part: P,
        ...payload: P extends keyof PartPayloadMap
            ? [payload: PartPayloadMap[P]]
            : [payload?: Readonly<Record<string, unknown>>]
    ): PartAttributes;
    /**
     * gives focus back to a part that was remounted (an edge moved to another render level's
     * layer): when `element` is the part (`data-flow-part` and `data-flow-id`) that last had focus
     * in the flow and focus was lost (its document's active element is its body, or none), it is
     * focused again, without scrolling
     */
    refocus(element: Element): void;
    /** calls `listener` when the view changed (not the model: adapters subscribe to it); returns its remover */
    subscribe(listener: (change: ViewChange) => void): () => void;
    /** a number that changes whenever the view changes */
    getSnapshot(): number;
}
