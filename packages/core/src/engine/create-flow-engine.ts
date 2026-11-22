// The flow engine (D4, D8-D13): one flow on screen. It owns the viewport (written to its element
// directly), measures nodes and handles with the root window's `ResizeObserver`, draws edges'
// paths, and runs every gesture on Pointer Events with capture (pan, pinch, the features' drags),
// the wheel and the keys, behind the same five verbs as the model; the installed features add
// theirs. It changes the flow only by running the model's commands, so every middleware sees what
// a drag, a connection or a key does. It never touches the global `document` or `window`: every
// DOM access goes through the root element (its `ownerDocument`, its `defaultView`).
import {
    END_ATTRIBUTE,
    flag,
    ID_ATTRIBUTE,
    type MutablePartAttributes,
    NO_WHEEL_ATTRIBUTE,
    PART_ATTRIBUTE,
    type PartAttributes,
    POSITION_ATTRIBUTE,
} from "../attributes/part-attributes";
import { fail, ok } from "../commands/define";
import type { CommandResult } from "../commands/types";
import type {
    AnyTypes,
    FlowEdge,
    FlowNode,
    FlowTypes,
    XY,
} from "../document/types";
import type { OwnedBy } from "../features/keys";
import { requiresFeature } from "../features/keys";
import {
    type ComposedFeatureEngine,
    featureEngine,
    featuresOf,
} from "../features/registry";
import type {
    EngineActionKeyOf,
    EngineGetKeyOf,
    EngineIsKeyOf,
    FeatureEngineHost,
    FeatureGesture,
    FeatureModel,
    FlowFeatures,
} from "../features/types";
import {
    boundsOf,
    contains,
    cornerInside,
    intersectionOf,
    nodeBox,
    overlaps,
    sharesArea,
} from "../geometry/rect";
import type { EdgePath, Rect, Viewport } from "../geometry/types";
import {
    isFitPadding,
    type ViewportForBoundsOptions,
    viewportForBounds,
} from "../geometry/viewport-for-bounds";
import {
    centeredOn,
    clampZoom,
    keptInExtent,
    type Size,
    toFlow,
    toScreen,
    viewRect,
    zoomAround,
} from "../geometry/viewport-math";
import type { FlowModel } from "../model/create-flow-model";
import type { HandleType, QueryArgs } from "../state/queries";
import type {
    FlowEngineAdapter,
    FlowHandle,
    HandleRegistration,
    PressTarget,
    ViewChange,
} from "./adapter";
import { type AutoPanOptions, autoPanOffset, autoPans } from "./auto-pan";
import { backgroundPattern } from "./background-pattern";
import { asElement, pressTargetOf, viewOf } from "./dom";
import { edgeEnds, type PathOptions, pathOf } from "./edge-geometry";
import { edgeToolbarPosition } from "./edge-toolbar";
import type { FlowEngineEvent, FlowPointerInfo } from "./events";
import {
    INTERACTION_KINDS,
    type InteractionKind,
    type Interactivity,
} from "./interactivity";
import { Measurements } from "./measurements";
import { nodeToolbarPosition } from "./node-toolbar";
import {
    clearRootTouchAction,
    clearViewportTransform,
    writeRootTouchAction,
    writeViewportTransform,
} from "./structural-style";
import { TAP_TOLERANCE } from "./tap";
import type {
    BackgroundPatternPayload,
    EdgeToolbarPayload,
    EngineActionKey,
    EngineActionPayload,
    EngineActionResult,
    EngineGetKey,
    EngineGetPayload,
    EngineGetResult,
    EngineIsKey,
    EngineIsPayload,
    FitViewPayload,
    NodeToolbarPayload,
    ZoomStepPayload,
} from "./verbs";
import { animateViewport, type ViewportEasing } from "./viewport-animation";
import { WHEEL_PINCH_RATE, WHEEL_RATE, WHEEL_REST } from "./wheel-rate";

/** Which way the wheel pans with `panOnScroll`: both ways, or one axis only. */
export type PanOnScrollMode = "free" | "horizontal" | "vertical";

/** Options of {@link createFlowEngine}. */
export interface FlowEngineOptions {
    /** the root element; an adapter may attach it later (`engine.adapter.attachRoot`) */
    root?: HTMLElement | undefined;
    /** the viewport it starts at; default `{ x: 0, y: 0, zoom: 1 }` */
    defaultViewport?: Viewport | undefined;
    /** the least zoom; default 0.5 */
    minZoom?: number | undefined;
    /** the greatest zoom; default 2 */
    maxZoom?: number | undefined;
    /** the flow rectangle the view stays inside; default none */
    translateExtent?: Rect | undefined;
    /**
     * a drag on the pane pans: `true` with the primary button (and a touch or a pen), or the mouse
     * buttons that pan (`[0]` primary, `[1]` middle, `[2]` right); default true
     */
    panOnDrag?: boolean | readonly number[] | undefined;
    /**
     * the key that, held, makes a primary drag pan from anywhere (nodes included) and start no
     * other gesture (`KeyboardEvent.key`, or `.code`); null for none; default `" "` (Space)
     */
    panActivationKey?: string | null | undefined;
    /** the wheel pans (Ctrl + wheel zooms); default false: the wheel zooms */
    panOnScroll?: boolean | undefined;
    /** which way the wheel pans with `panOnScroll`; default `"free"` */
    panOnScrollMode?: PanOnScrollMode | undefined;
    /** the factor of the wheel's pixels when it pans (`panOnScroll`); default 1 */
    panOnScrollSpeed?: number | undefined;
    /**
     * the key that, held, makes the wheel zoom while `panOnScroll` is on (`KeyboardEvent.key`;
     * `Meta`, `Control`, `Alt` and `Shift` read from the wheel event); null for none; default
     * `Meta` on Apple platforms and `Control` elsewhere (the root window's `navigator`)
     */
    zoomActivationKey?: string | null | undefined;
    /** the wheel zooms around the pointer; default true */
    zoomOnScroll?: boolean | undefined;
    /** a two-finger pinch (and a trackpad's) zooms; default true */
    zoomOnPinch?: boolean | undefined;
    /** a double click on the pane zooms in; default true */
    zoomOnDoubleClick?: boolean | undefined;
    /** the factor of `zoom-in` and `zoom-out`; default 1.2 */
    zoomStep?: number | undefined;
    /** fits the nodes once they are all measured (`fit-view`'s options); default false */
    fitView?: boolean | FitViewPayload | undefined;
    /** whether gestures and keys may change the flow (`set-interactive`); default true */
    interactive?: boolean | undefined;
    /** adapters render only the nodes and edges in view; default false */
    onlyRenderVisible?: boolean | undefined;
    /** the shape of the built-in edge paths */
    pathOptions?: PathOptions | undefined;
    /**
     * the viewport pans while a drag, a connection, a reconnection, a selection box or a resize
     * has its pointer near the root's edge (`{ speed, margin }` tunes it; `{ node, connect,
     * selection, resize }` turn it off for one gesture); default true
     */
    autoPan?: boolean | AutoPanOptions | undefined;
    /**
     * how far (in pixels) a press on the pane may move and still be a tap (a click: it clears the
     * selection, `pane-click`); default 3
     */
    paneClickDistance?: number | undefined;
    /**
     * how far (in pixels) a press on a node, an edge or a handle may move and still be a tap (it
     * selects, `node-click`; with click-to-connect a handle's drag starts past it); default 3
     */
    nodeClickDistance?: number | undefined;
    /**
     * the wheel over the flow never scrolls the page, even when neither `zoomOnScroll` nor
     * `panOnScroll` uses it (a `data-flow-no-wheel` element and the controls keep theirs);
     * default true
     */
    preventScrolling?: boolean | undefined;
    /** nodes take focus (with `keyboard()`; a node's `focusable: false` still wins); default true */
    nodesFocusable?: boolean | undefined;
    /** edges take focus (with `keyboard()`; an edge's `focusable: false` still wins); default true */
    edgesFocusable?: boolean | undefined;
    /** how an animated viewport action (its `duration`) eases; default a smooth ease in and out */
    easing?: ViewportEasing | undefined;
    /**
     * the point of a node's box its `position` stands at, as shares of its size (`{ x: 0.5, y: 0.5 }`:
     * its centre), for the nodes on the flow (a child's position is its box's top-left corner in its
     * parent's); default `{ x: 0, y: 0 }`: the top-left corner
     */
    nodeOrigin?: XY | undefined;
    /** the flow rectangle every node's box stays inside when dragged, moved by keys or resized */
    nodeExtent?: Rect | undefined;
    /** a selected node, and its children with it, is drawn above the others; default true */
    elevateNodesOnSelect?: boolean | undefined;
    /** a selected edge is drawn above the other edges; default false */
    elevateEdgesOnSelect?: boolean | undefined;
}

/**
 * One flow on screen. Every member is one verb, as on the model, and bound: `run` a screen
 * action, `can` / `check` it, `get` a fact of the screen, `is` a yes/no question; `subscribe`
 * listens to what happens on screen (D12: the events an app announces); `destroy` releases it.
 * `adapter` is what only an adapter calls.
 */
export interface FlowEngine<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
> {
    run<K extends EngineActionKeyOf<F>>(
        action: K,
        ...payload: QueryArgs<EngineActionPayload<K>>
    ): CommandResult<EngineActionResult<K>>;
    can<K extends EngineActionKeyOf<F>>(
        action: K,
        ...payload: QueryArgs<EngineActionPayload<K>>
    ): boolean;
    check<K extends EngineActionKeyOf<F>>(
        action: K,
        ...payload: QueryArgs<EngineActionPayload<K>>
    ): CommandResult<EngineActionResult<K>>;
    get<K extends EngineGetKeyOf<F>>(
        key: K,
        ...payload: QueryArgs<EngineGetPayload<K>>
    ): EngineGetResult<T, K>;
    is<K extends EngineIsKeyOf<F>>(
        key: K,
        ...payload: QueryArgs<EngineIsPayload<K>>
    ): boolean;
    /** listens to what happens on screen (a drag's drop, a connection, the viewport); returns its remover */
    subscribe(listener: (event: FlowEngineEvent) => void): () => void;
    /** releases every listener and element; no command runs afterwards */
    destroy(): void;
    /** what only an adapter calls */
    readonly adapter: FlowEngineAdapter;
}

type ActionHandler = (
    payload: unknown,
    dryRun: boolean,
) => CommandResult<unknown>;

/** A press under way: its pointer, where it started, and the gesture that took it. */
interface Press {
    readonly pointerId: number;
    readonly start: XY;
    readonly target: PressTarget;
    readonly gesture: FeatureGesture | undefined;
    readonly pan: boolean;
    /** the mouse button pressed (0 for a touch or a pen) */
    readonly button: number;
    /** started by the pan activation key: it pans and never taps */
    readonly keyPan: boolean;
    /** its gesture is the one a tap started (click-to-connect): its release is the gesture's end */
    readonly follows: boolean;
    travel: number;
    /** a context menu opened during it (a long press, Ctrl + click): its release is no tap */
    menu: boolean;
    /** its pointer's last move: a press whose release was missed ends there */
    last: PointerEvent | undefined;
}

/** What the last press released: a tap (on what) or not, for a double click. */
interface Released {
    readonly target: PressTarget;
    readonly tap: boolean;
}

/** A tap's target as its event's: a node, an edge or the pane (anything else has none). */
type TapOn =
    | { readonly kind: "node"; readonly nodeId: string }
    | { readonly kind: "edge"; readonly edgeId: string }
    | { readonly kind: "pane" };

function tapOn(target: PressTarget): TapOn | undefined {
    if (target.kind === "node" && target.nodeId !== undefined)
        return { kind: "node", nodeId: target.nodeId };
    if (target.kind === "edge" && target.edgeId !== undefined)
        return { kind: "edge", edgeId: target.edgeId };
    if (target.kind === "pane") return { kind: "pane" };
    return undefined;
}

/** A pinch under way: its two pointers and where they started. */
interface Pinch {
    readonly ids: readonly [number, number];
    /** the fingers' spread when it began */
    readonly distance: number;
    /** the zoom when it began */
    readonly zoom: number;
    /** the flow point under the fingers' middle when it began */
    readonly anchor: XY;
}

const ZERO_SIZE: Size = { width: 0, height: 0 };

const TOP_LEFT: XY = { x: 0, y: 0 };

/** What a selected node (with `elevateNodesOnSelect`) or edge (`elevateEdgesOnSelect`) is raised by. */
const SELECTED_RAISE = 10_000;

/** A `zIndex` as a number (none, or not a finite number: 0). */
function zOf(value: unknown): number {
    return finite(value) ? value : 0;
}

function finite(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function payloadRecord(payload: unknown): Record<string, unknown> {
    return payload !== null && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : {};
}

function pointOf(value: unknown): XY | undefined {
    const record = payloadRecord(value);
    return finite(record.x) && finite(record.y)
        ? { x: record.x, y: record.y }
        : undefined;
}

function sameViewport(a: Viewport, b: Viewport): boolean {
    return a.x === b.x && a.y === b.y && a.zoom === b.zoom;
}

function distance(a: XY, b: XY): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
}

/** What typing goes into: a key pressed there never activates a pan or a zoom. */
const EDITABLE =
    'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

/** The keys a pointer or wheel event tells itself whether they are held. */
const MODIFIERS: Readonly<
    Record<string, "metaKey" | "ctrlKey" | "altKey" | "shiftKey">
> = { Meta: "metaKey", Control: "ctrlKey", Alt: "altKey", Shift: "shiftKey" };

/** A viewport action's `duration`, in milliseconds (0 when it leaves it out), or its failure. */
function durationOf(payload: unknown): number | CommandResult<unknown> {
    const { duration } = payloadRecord(payload);
    if (duration === undefined) return 0;
    if (!finite(duration) || duration < 0) {
        return fail(
            "invalid_payload",
            "duration must be a number of milliseconds, 0 or more",
            "/duration",
        );
    }
    return duration;
}

class Engine<T extends FlowTypes, F extends FlowFeatures> {
    readonly model: FlowModel;
    readonly adapter: FlowEngineAdapter;
    private options: FlowEngineOptions;
    private minZoom: number;
    private maxZoom: number;
    private readonly measurements: Measurements;
    private readonly features: ComposedFeatureEngine;
    private readonly shared = new Map<string, unknown>();
    private readonly partOptions = new Map<
        string,
        Readonly<Record<string, unknown>>
    >();
    private readonly listeners = new Set<(event: FlowEngineEvent) => void>();
    private readonly adapterListeners = new Set<(change: ViewChange) => void>();
    private readonly actions: Record<
        Exclude<EngineActionKey, OwnedBy<"engineRun">>,
        ActionHandler
    >;
    private current: Viewport;
    private interactivity: Interactivity;
    /** the viewport is changing (a gesture or an animation): `viewport-change-start` was told */
    private moving: { readonly gesture: boolean } | undefined;
    /** a pointer press or a wheel is being handled: its viewport changes belong to one move */
    private handling = 0;
    /** the wheel's rest timer: the move it started ends when it fires */
    private wheelRest: { view: Window; id: number } | undefined;
    /** what the last primary press released (a double click needs two taps) */
    private released: Released | undefined;
    /** the root was sized and every shown node measured (`ready`, once) */
    private ready = false;
    private rootElement: HTMLElement | undefined;
    private viewportElement: HTMLElement | SVGElement | undefined;
    private removeRootListeners: (() => void) | undefined;
    private press: Press | undefined;
    /**
     * a gesture a tap started that goes on without a press (click-to-connect): the pointer's moves
     * move it, and the next primary press is its own
     */
    private following: FeatureGesture | undefined;
    private pinch: Pinch | undefined;
    private readonly pointers = new Map<number, XY>();
    private pendingFit: FitViewPayload | undefined;
    /** stops the viewport animation under way */
    private stopAnimation: (() => void) | undefined;
    /** the auto-pan's pending frame, and its window */
    private autoPanFrame: { view: Window; id: number } | undefined;
    /** the keys held now (`key` and `code`), from the root's document */
    private readonly heldKeys = new Set<string>();
    /** a non-primary pan moved: the context menu its release opens is kept out */
    private blockContextMenu = false;
    private revision = 0;
    private destroyed = false;

    constructor(model: FlowModel<T, F>, options: FlowEngineOptions) {
        this.model = model as unknown as FlowModel;
        this.options = options;
        this.minZoom = options.minZoom ?? 0.5;
        this.maxZoom = Math.max(this.minZoom, options.maxZoom ?? 2);
        const start = options.defaultViewport ?? { x: 0, y: 0, zoom: 1 };
        this.current = {
            x: start.x,
            y: start.y,
            zoom: clampZoom(start.zoom, this.minZoom, this.maxZoom),
        };
        this.interactivity = Object.freeze({
            interactive: options.interactive ?? true,
            drag: true,
            connect: true,
            select: true,
            reconnect: true,
        });
        this.pendingFit =
            options.fitView === true
                ? {}
                : options.fitView === false
                  ? undefined
                  : options.fitView;
        this.measurements = new Measurements(
            () => this.current.zoom,
            () => this.measured(),
            (nodeId) => this.model.get("node-by", { id: nodeId }) !== undefined,
        );
        // a node removed while it was not rendered (culled, hidden) has its kept sizes forgotten
        this.stopPrune = this.model.subscribe(() => this.measurements.prune());
        this.features = featureEngine(featuresOf(model), this.host());
        this.actions = {
            "set-viewport": (payload, dryRun) =>
                this.setViewportAction(payload, dryRun),
            "pan-by": (payload, dryRun) => {
                const by = pointOf(payload);
                if (!by)
                    return fail("invalid_payload", "x and y must be numbers");
                return this.apply(
                    {
                        ...this.current,
                        x: this.current.x + by.x,
                        y: this.current.y + by.y,
                    },
                    dryRun,
                );
            },
            "zoom-in": (payload, dryRun) => this.zoomStep(payload, dryRun, 1),
            "zoom-out": (payload, dryRun) => this.zoomStep(payload, dryRun, -1),
            "zoom-to": (payload, dryRun) => {
                const { zoom, around } = payloadRecord(payload);
                if (!finite(zoom) || zoom <= 0) {
                    return fail(
                        "invalid_payload",
                        "zoom must be a positive number",
                        "/zoom",
                    );
                }
                const duration = durationOf(payload);
                if (typeof duration !== "number") return duration;
                return this.apply(
                    zoomAround(
                        this.current,
                        clampZoom(zoom, this.minZoom, this.maxZoom),
                        pointOf(around) ?? this.center(),
                    ),
                    dryRun,
                    duration,
                );
            },
            "fit-view": (payload, dryRun) =>
                this.fitView(payloadRecord(payload) as FitViewPayload, dryRun),
            "center-on": (payload, dryRun) => {
                const at = pointOf(payload);
                const { zoom } = payloadRecord(payload);
                if (!at)
                    return fail("invalid_payload", "x and y must be numbers");
                if (zoom !== undefined && (!finite(zoom) || zoom <= 0)) {
                    return fail(
                        "invalid_payload",
                        "zoom must be a positive number",
                        "/zoom",
                    );
                }
                const duration = durationOf(payload);
                if (typeof duration !== "number") return duration;
                return this.apply(
                    centeredOn(
                        at,
                        clampZoom(
                            zoom ?? this.current.zoom,
                            this.minZoom,
                            this.maxZoom,
                        ),
                        this.rootSize(),
                    ),
                    dryRun,
                    duration,
                );
            },
            "focus-node": (payload, dryRun) => this.focusNode(payload, dryRun),
            "set-interactive": (payload, dryRun) =>
                this.setInteractive(payload, dryRun),
            "cancel-gesture": (_payload, dryRun) => {
                this.dropEnded();
                if (
                    !this.press &&
                    !this.pinch &&
                    !this.following &&
                    !this.stopAnimation
                ) {
                    return fail(
                        "refused",
                        "no gesture nor viewport animation is under way",
                    );
                }
                if (!dryRun) {
                    this.cancelPress();
                    this.cancelFollowing();
                    this.endPinch();
                    this.stopViewportAnimation();
                }
                return ok({});
            },
        };
        this.adapter = this.createAdapter();
        if (options.root) this.attachRoot(options.root);
    }

    // ---------------------------------------------------------------------------------------------
    // the verbs
    // ---------------------------------------------------------------------------------------------

    /**
     * `set-interactive`: the switches given change, the others stay; a switch turned off cancels
     * the gesture under way (a press, a connection waiting without one).
     */
    private setInteractive(
        payload: unknown,
        dryRun: boolean,
    ): CommandResult<unknown> {
        const record = payloadRecord(payload);
        const keys = ["interactive", ...INTERACTION_KINDS] as const;
        const given = keys.filter((key) => record[key] !== undefined);
        if (given.length === 0) {
            return fail(
                "invalid_payload",
                "give at least one of interactive, drag, connect, select, reconnect",
            );
        }
        for (const key of given) {
            if (typeof record[key] !== "boolean") {
                return fail(
                    "invalid_payload",
                    `${key} must be a boolean`,
                    `/${key}`,
                );
            }
        }
        const next: Interactivity = Object.freeze({
            ...this.interactivity,
            ...Object.fromEntries(given.map((key) => [key, record[key]])),
        });
        if (dryRun) return ok(next);
        const before = this.interactivity;
        if (keys.some((key) => before[key] !== next[key])) {
            // the gestures a switch turned off stop: every one with `interactive`, else those of
            // that kind (a pan, a resize or another kind's gesture goes on)
            // (a reconnection needs `connect` too, so `connect` off stops one as well)
            const off = (kind: InteractionKind | undefined) =>
                (before.interactive && !next.interactive) ||
                (kind !== undefined && before[kind] && !next[kind]) ||
                (kind === "reconnect" && before.connect && !next.connect);
            if (off(this.press?.gesture?.kind)) this.cancelPress();
            if (off(this.following?.kind)) this.cancelFollowing();
            this.interactivity = next;
            this.notify({ gesture: true });
        }
        return ok(this.interactivity);
    }

    /** Whether gestures and keys of a kind may change the flow now. */
    private allows(kind: InteractionKind): boolean {
        return this.interactivity.interactive && this.interactivity[kind];
    }

    run(action: string, payload?: unknown): CommandResult<unknown> {
        return this.perform(action, payload, false);
    }

    can(action: string, payload?: unknown): boolean {
        return this.perform(action, payload, true).ok;
    }

    check(action: string, payload?: unknown): CommandResult<unknown> {
        return this.perform(action, payload, true);
    }

    private perform(
        action: string,
        payload: unknown,
        dryRun: boolean,
    ): CommandResult<unknown> {
        if (this.destroyed) return fail("refused", "the engine was destroyed");
        const handler = Object.hasOwn(this.actions, action)
            ? this.actions[action as keyof typeof this.actions]
            : this.features.run.get(action);
        if (!handler) {
            const owner = featuresOf(this.model).missing("engineRun", action);
            return owner !== undefined
                ? fail("not_found", `"${action}" ${requiresFeature(owner)}`)
                : fail("unknown_command", `unknown action "${action}"`);
        }
        return handler(payload ?? {}, dryRun);
    }

    get(key: string, payload?: unknown): unknown {
        const values = {
            viewport: () => this.current,
            "root-size": () => this.rootSize(),
            "edge-path-by": (p) =>
                this.edgePath(String(payloadRecord(p).edgeId)),
            "node-rect-by": (p) =>
                this.nodeRect(String(payloadRecord(p).nodeId)),
            "nodes-bounds": (p) => {
                const { nodeIds } = payloadRecord(p);
                return this.boundsOf(
                    Array.isArray(nodeIds) ? nodeIds : undefined,
                );
            },
            "intersecting-nodes": (p) => this.intersectingNodes(p),
            "viewport-for-bounds": (p) => this.viewportForBoundsRead(p),
            "screen-to-flow": (p) => {
                const point = pointOf(p);
                return point ? this.toFlow(point) : undefined;
            },
            "flow-to-screen": (p) => {
                const point = pointOf(p);
                return point ? this.toClient(point) : undefined;
            },
            "visible-nodes": () => this.visibleNodes(),
            "visible-edges": () => this.visibleEdges(),
            "drawn-edges": () => this.drawnEdges(),
            "node-z-index-by": (p) =>
                this.nodeZ(String(payloadRecord(p).nodeId)),
            "handles-by": (p) => {
                const nodeId = String(payloadRecord(p).nodeId);
                return this.measurements
                    .handlesOf(nodeId)
                    .map((handle) => this.placed(handle));
            },
            "background-pattern": (p) =>
                backgroundPattern(
                    this.current,
                    payloadRecord(p) as BackgroundPatternPayload,
                ),
            "node-toolbar-by": (p) => {
                const request = payloadRecord(p) as NodeToolbarPayload;
                const many = Array.isArray(request.nodeIds)
                    ? request.nodeIds.filter(
                          (nodeId): nodeId is string =>
                              typeof nodeId === "string",
                      )
                    : [];
                const rect =
                    many.length > 0
                        ? this.boundsOf(many)
                        : typeof request.nodeId === "string"
                          ? this.knownRect(request.nodeId)
                          : undefined;
                return rect
                    ? nodeToolbarPosition(rect, this.current, request)
                    : undefined;
            },
            "edge-toolbar-by": (p) => {
                const request = payloadRecord(
                    p,
                ) as unknown as EdgeToolbarPayload;
                const path =
                    typeof request.edgeId === "string"
                        ? this.edgePath(request.edgeId)
                        : undefined;
                return path
                    ? edgeToolbarPosition(path, this.current, {
                          ...request,
                          offset: pointOf(request.offset),
                      })
                    : undefined;
            },
        } satisfies {
            [G in Exclude<EngineGetKey, OwnedBy<"engineGet">>]: (
                payload: unknown,
            ) => unknown;
        };
        if (Object.hasOwn(values, key)) {
            return values[key as keyof typeof values](payload ?? {});
        }
        return this.features.get.get(key)?.(payload ?? {});
    }

    is(key: string, payload?: unknown): boolean {
        const questions = {
            interactive: () => this.interactivity.interactive,
            "interactive-by": (p) => {
                const { kind } = payloadRecord(p);
                return (
                    typeof kind === "string" &&
                    (INTERACTION_KINDS as readonly string[]).includes(kind) &&
                    this.allows(kind as InteractionKind)
                );
            },
            ready: () => this.ready,
            panning: () =>
                this.pinch !== undefined ||
                (this.press?.pan === true && this.press.travel > 0),
            "node-measured": (p) =>
                this.knownRect(String(payloadRecord(p).nodeId)) !== undefined,
        } satisfies {
            [G in Exclude<EngineIsKey, OwnedBy<"engineIs">>]: (
                payload: unknown,
            ) => boolean;
        };
        if (Object.hasOwn(questions, key)) {
            return questions[key as keyof typeof questions](payload ?? {});
        }
        return this.features.is.get(key)?.(payload ?? {}) ?? false;
    }

    subscribe(listener: (event: FlowEngineEvent) => void): () => void {
        const wrapper = (event: FlowEngineEvent) => listener(event);
        this.listeners.add(wrapper);
        return () => {
            this.listeners.delete(wrapper);
        };
    }

    destroy(): void {
        if (this.destroyed) return;
        this.detachRoot();
        this.stopViewportAnimation();
        this.destroyed = true;
        this.features.destroy();
        if (this.viewportElement) clearViewportTransform(this.viewportElement);
        this.viewportElement = undefined;
        this.stopPrune();
        this.measurements.destroy();
        this.listeners.clear();
        this.adapterListeners.clear();
        this.shared.clear();
    }

    // ---------------------------------------------------------------------------------------------
    // the viewport
    // ---------------------------------------------------------------------------------------------

    /** A viewport kept to the zoom limits and the translate extent. */
    private kept(viewport: Viewport): Viewport {
        const zoom = clampZoom(viewport.zoom, this.minZoom, this.maxZoom);
        let next: Viewport = { x: viewport.x, y: viewport.y, zoom };
        const extent = this.options.translateExtent;
        const size = this.rootSize();
        if (extent && size.width > 0 && size.height > 0) {
            next = keptInExtent(next, size, extent);
        }
        return next;
    }

    /** Sets the viewport: writes its transform, tells the adapters and the app. */
    private setViewport(viewport: Viewport, gesture: boolean): Viewport {
        // a gesture (a pan, the wheel, a pinch, the minimap, auto-pan) takes the viewport over
        if (gesture) this.stopViewportAnimation();
        const next = this.kept(viewport);
        if (sameViewport(next, this.current)) return this.current;
        if (!this.moving) {
            this.moving = { gesture };
            this.emit({
                type: "viewport-change-start",
                viewport: this.current,
                gesture,
            });
        }
        this.current = Object.freeze(next);
        if (this.viewportElement) {
            writeViewportTransform(this.viewportElement, this.current);
        }
        this.notify({ viewport: true });
        this.emit({ type: "viewport-change", viewport: this.current, gesture });
        this.settle();
        return this.current;
    }

    /**
     * Ends the viewport's move (`viewport-change-end`) once nothing that moves it is under way: no
     * press, pinch, animation or resting wheel, and (unless `now`: an animation was stopped) no
     * press or wheel being handled.
     */
    private settle(now = false): void {
        const moving = this.moving;
        if (
            !moving ||
            (!now && this.handling > 0) ||
            this.press ||
            this.pinch ||
            this.stopAnimation ||
            this.wheelRest
        ) {
            return;
        }
        this.moving = undefined;
        this.emit({
            type: "viewport-change-end",
            viewport: this.current,
            gesture: moving.gesture,
        });
    }

    /** (Re)starts the wheel's rest timer: the move it started ends when the wheel rests. */
    private restWheel(): void {
        this.stopWheelRest();
        if (!this.moving) return;
        const view = viewOf(this.rootElement);
        if (!view || typeof view.setTimeout !== "function") {
            this.settle();
            return;
        }
        const id = view.setTimeout(() => {
            if (this.wheelRest?.id !== id) return;
            this.wheelRest = undefined;
            this.settle();
        }, WHEEL_REST);
        this.wheelRest = { view, id };
    }

    private stopWheelRest(): void {
        const rest = this.wheelRest;
        this.wheelRest = undefined;
        if (rest) rest.view.clearTimeout(rest.id);
    }

    /**
     * A viewport action's change: at once, or (`duration`, with a root whose window has frames)
     * animated to the viewport it returns; either way an animation under way stops.
     */
    private apply(
        viewport: Viewport,
        dryRun: boolean,
        duration = 0,
    ): CommandResult<unknown> {
        if (
            !finite(viewport.x) ||
            !finite(viewport.y) ||
            !finite(viewport.zoom) ||
            viewport.zoom <= 0
        ) {
            return fail(
                "invalid_payload",
                "the viewport must be finite numbers",
            );
        }
        if (dryRun) return ok(this.kept(viewport));
        this.stopViewportAnimation();
        const target = this.kept(viewport);
        const view = viewOf(this.rootElement);
        if (
            duration > 0 &&
            view &&
            typeof view.requestAnimationFrame === "function" &&
            !sameViewport(target, this.current)
        ) {
            const stop = animateViewport({
                view,
                from: this.current,
                to: target,
                duration,
                easing: this.options.easing,
                step: (next) => {
                    this.setViewport(next, false);
                },
                done: () => {
                    if (this.stopAnimation === stop) {
                        this.stopAnimation = undefined;
                        this.settle();
                    }
                },
            });
            this.stopAnimation = stop;
            return ok(Object.freeze(target));
        }
        return ok(this.setViewport(viewport, false));
    }

    /** Stops the viewport animation under way, where it is. */
    private stopViewportAnimation(): void {
        const stop = this.stopAnimation;
        if (!stop) return;
        this.stopAnimation = undefined;
        stop();
        this.settle(true);
    }

    private setViewportAction(
        payload: unknown,
        dryRun: boolean,
    ): CommandResult<unknown> {
        const record = payloadRecord(payload);
        for (const key of ["x", "y", "zoom"] as const) {
            if (record[key] !== undefined && !finite(record[key])) {
                return fail(
                    "invalid_payload",
                    `${key} must be a number`,
                    `/${key}`,
                );
            }
        }
        const duration = durationOf(payload);
        if (typeof duration !== "number") return duration;
        return this.apply(
            {
                x: (record.x as number | undefined) ?? this.current.x,
                y: (record.y as number | undefined) ?? this.current.y,
                zoom: (record.zoom as number | undefined) ?? this.current.zoom,
            },
            dryRun,
            duration,
        );
    }

    private zoomStep(
        payload: unknown,
        dryRun: boolean,
        direction: 1 | -1,
    ): CommandResult<unknown> {
        const { step, around } = payloadRecord(payload) as ZoomStepPayload;
        const duration = durationOf(payload);
        if (typeof duration !== "number") return duration;
        const factor = step ?? this.options.zoomStep ?? 1.2;
        if (!finite(factor) || factor <= 1) {
            return fail(
                "invalid_payload",
                "step must be a number above 1",
                "/step",
            );
        }
        const zoom = clampZoom(
            direction > 0
                ? this.current.zoom * factor
                : this.current.zoom / factor,
            this.minZoom,
            this.maxZoom,
        );
        if (zoom === this.current.zoom) {
            return fail(
                "refused",
                direction > 0
                    ? "the zoom is at its greatest"
                    : "the zoom is at its least",
            );
        }
        return this.apply(
            zoomAround(this.current, zoom, pointOf(around) ?? this.center()),
            dryRun,
            duration,
        );
    }

    private fitView(
        payload: FitViewPayload,
        dryRun: boolean,
    ): CommandResult<unknown> {
        const duration = durationOf(payload);
        if (typeof duration !== "number") return duration;
        if (payload.padding !== undefined && !isFitPadding(payload.padding)) {
            return fail(
                "invalid_payload",
                'padding must be a number, a "<n>px" string, or { top, right, bottom, left } of them',
                "/padding",
            );
        }
        const size = this.rootSize();
        if (size.width <= 0 || size.height <= 0) {
            return fail("refused", "the root has no size yet");
        }
        const bounds = this.boundsOf(
            payload.nodeIds,
            payload.includeHidden === true,
        );
        if (!bounds) return fail("refused", "no node has a size yet");
        return this.apply(
            this.framing(bounds, size, payload),
            dryRun,
            duration,
        );
    }

    /**
     * The viewport that frames `bounds` in the root (`viewportForBounds`): `fit-view`'s and
     * `viewport-for-bounds`'; its own zoom limits default to the engine's (which still bound it).
     */
    private framing(
        bounds: Rect,
        size: Size,
        options: ViewportForBoundsOptions,
    ): Viewport {
        return viewportForBounds(bounds, size.width, size.height, {
            padding: options.padding ?? 0.1,
            minZoom: options.minZoom ?? this.minZoom,
            maxZoom: options.maxZoom ?? this.maxZoom,
        });
    }

    /** `viewport-for-bounds`: the viewport `fit-view` would set for a flow rectangle. */
    private viewportForBoundsRead(payload: unknown): Viewport | undefined {
        const record = payloadRecord(payload);
        const bounds = payloadRecord(record.bounds);
        const size = this.rootSize();
        if (
            size.width <= 0 ||
            size.height <= 0 ||
            !finite(bounds.x) ||
            !finite(bounds.y) ||
            !finite(bounds.width) ||
            !finite(bounds.height) ||
            bounds.width < 0 ||
            bounds.height < 0
        ) {
            return undefined;
        }
        return Object.freeze(
            this.kept(
                this.framing(
                    {
                        x: bounds.x,
                        y: bounds.y,
                        width: bounds.width,
                        height: bounds.height,
                    },
                    size,
                    {
                        padding: isFitPadding(record.padding)
                            ? record.padding
                            : undefined,
                        minZoom: finite(record.minZoom)
                            ? record.minZoom
                            : undefined,
                        maxZoom: finite(record.maxZoom)
                            ? record.maxZoom
                            : undefined,
                    },
                ),
            ),
        );
    }

    private focusNode(
        payload: unknown,
        dryRun: boolean,
    ): CommandResult<unknown> {
        const nodeId = payloadRecord(payload).nodeId;
        if (typeof nodeId !== "string") {
            return fail(
                "invalid_payload",
                "nodeId must be a string",
                "/nodeId",
            );
        }
        if (!this.model.get("node-by", { id: nodeId })) {
            return fail("not_found", `no node "${nodeId}"`, "/nodeId");
        }
        const element = this.measurements.nodeElement(nodeId);
        if (!element)
            return fail(
                "refused",
                `node "${nodeId}" is not rendered`,
                "/nodeId",
            );
        if (dryRun) return ok({ nodeId });
        if (element.ownerDocument.activeElement !== element) {
            element.focus({ preventScroll: true });
        }
        this.reveal(nodeId);
        return ok({ nodeId });
    }

    /** Pans a node into view (its centre in the root's centre) when it is not wholly in view. */
    private reveal(nodeId: string): void {
        const rect = this.knownRect(nodeId);
        const size = this.rootSize();
        if (!rect || size.width <= 0) return;
        const view = viewRect(this.current, size);
        const inside =
            rect.x >= view.x &&
            rect.y >= view.y &&
            rect.x + rect.width <= view.x + view.width &&
            rect.y + rect.height <= view.y + view.height;
        if (!inside) {
            this.stopViewportAnimation();
            this.setViewport(
                centeredOn(
                    { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
                    this.current.zoom,
                    size,
                ),
                false,
            );
        }
    }

    /** The root's client box (its position on the page and its size). */
    private rootBox(): Rect {
        const box = this.rootElement?.getBoundingClientRect();
        return box
            ? { x: box.left, y: box.top, width: box.width, height: box.height }
            : { x: 0, y: 0, width: 0, height: 0 };
    }

    private rootSize(): Size {
        const box = this.rootBox();
        return box.width > 0 || box.height > 0
            ? { width: box.width, height: box.height }
            : ZERO_SIZE;
    }

    private center(): XY {
        const size = this.rootSize();
        return { x: size.width / 2, y: size.height / 2 };
    }

    private toRoot(client: XY): XY {
        const box = this.rootBox();
        return { x: client.x - box.x, y: client.y - box.y };
    }

    private toFlow(client: XY): XY {
        return toFlow(this.current, this.toRoot(client));
    }

    private toClient(point: XY): XY {
        const box = this.rootBox();
        const screen = toScreen(this.current, point);
        return { x: screen.x + box.x, y: screen.y + box.y };
    }

    /** How far a press on the pane, or on anything else, may move and still be a tap. */
    private tapDistance(on: "pane" | "node"): number {
        const option =
            on === "pane"
                ? this.options.paneClickDistance
                : this.options.nodeClickDistance;
        return finite(option) && option >= 0 ? option : TAP_TOLERANCE;
    }

    /** The tap distance of a press on `target`. */
    private tapDistanceOf(target: PressTarget): number {
        return this.tapDistance(target.kind === "pane" ? "pane" : "node");
    }

    // ---------------------------------------------------------------------------------------------
    // nodes, handles and edges on screen
    // ---------------------------------------------------------------------------------------------

    private node(nodeId: string): FlowNode | undefined {
        return this.model.get("node-by", { id: nodeId });
    }

    /** A node's size: the document's where it gives one, the measured one otherwise. */
    private sizeOf(node: FlowNode): Size | undefined {
        const measured = this.measurements.size(node.id);
        const usable =
            measured && (measured.width > 0 || measured.height > 0)
                ? measured
                : undefined;
        const width = node.width ?? usable?.width;
        const height = node.height ?? usable?.height;
        return width === undefined || height === undefined
            ? undefined
            : { width, height };
    }

    /**
     * The share of a node's size its position stands at: the engine's `nodeOrigin` for a node on
     * the flow, the top-left corner for a child (its position is relative to its parent's
     * top-left corner, so the model's sub-flow rules hold as they are).
     */
    private originOf(node: FlowNode): XY {
        if (node.parentId !== undefined && this.node(node.parentId)) {
            return TOP_LEFT;
        }
        return this.options.nodeOrigin ?? TOP_LEFT;
    }

    /** A node's position in absolute flow coordinates: its parent's top-left corner plus its own. */
    private absolutePosition(node: FlowNode, seen = new Set<string>()): XY {
        seen.add(node.id);
        const parent =
            node.parentId === undefined || seen.has(node.parentId)
                ? undefined
                : this.node(node.parentId);
        if (!parent) return node.position;
        const corner = this.boxOf(parent, seen);
        return {
            x: corner.x + node.position.x,
            y: corner.y + node.position.y,
        };
    }

    /** A node's absolute box (`nodeBox`: its position at its origin), its size zero until known. */
    private boxOf(node: FlowNode, seen = new Set<string>()): Rect {
        return nodeBox(
            this.absolutePosition(node, seen),
            this.sizeOf(node) ?? ZERO_SIZE,
            this.originOf(node),
        );
    }

    /** The top-left corner of a node's parent's box (0, 0 without one). */
    private parentCorner(node: FlowNode): XY {
        const parent =
            node.parentId === undefined ? undefined : this.node(node.parentId);
        return parent ? this.boxOf(parent) : TOP_LEFT;
    }

    /** A node's absolute box, its size zero until known. */
    private nodeRect(nodeId: string): Rect | undefined {
        const node = this.node(nodeId);
        return node ? this.boxOf(node) : undefined;
    }

    /** A node's absolute box, once its size is known. */
    private knownRect(nodeId: string): Rect | undefined {
        const node = this.node(nodeId);
        return node && this.sizeOf(node) ? this.boxOf(node) : undefined;
    }

    /**
     * The position (relative to its parent) that puts a node's box of `size` with its top-left
     * corner at the absolute flow point `corner`.
     */
    private positionFor(nodeId: string, corner: XY, size: Size): XY {
        const node = this.node(nodeId);
        if (!node) return corner;
        const parent = this.parentCorner(node);
        const origin = this.originOf(node);
        return {
            x: corner.x + origin.x * size.width - parent.x,
            y: corner.y + origin.y * size.height - parent.y,
        };
    }

    /**
     * The absolute rectangle a node's box stays inside: its parent's box (`extent: "parent"`,
     * with the measured sizes), its own rectangle `extent` (relative to its parent's top-left
     * corner for a child) and the engine's `nodeExtent`, together; none when nothing bounds it.
     */
    private extentOf(nodeId: string): Rect | undefined {
        const node = this.node(nodeId);
        if (!node) return undefined;
        const bounds: Rect[] = [];
        const parent =
            node.parentId === undefined ? undefined : this.node(node.parentId);
        const corner = parent ? this.boxOf(parent) : TOP_LEFT;
        if (parent && node.extent === "parent" && node.expandParent !== true) {
            const room = this.sizeOf(parent);
            bounds.push({
                x: corner.x,
                y: corner.y,
                width: room?.width ?? Number.POSITIVE_INFINITY,
                height: room?.height ?? Number.POSITIVE_INFINITY,
            });
        }
        const own = node.extent;
        if (typeof own === "object" && own !== null) {
            bounds.push({
                x: corner.x + own.x,
                y: corner.y + own.y,
                width: own.width,
                height: own.height,
            });
        }
        if (this.options.nodeExtent) bounds.push(this.options.nodeExtent);
        return intersectionOf(bounds);
    }

    /**
     * A node's position (relative to its parent) kept inside its extent (`extentOf`) with its
     * measured size; `size` overrides it (a resize under way).
     */
    private keepInExtent(nodeId: string, position: XY, size?: Size): XY {
        const node = this.node(nodeId);
        const bounds = this.extentOf(nodeId);
        if (!node || !bounds) return position;
        const own = size ?? this.sizeOf(node) ?? ZERO_SIZE;
        const parent = this.parentCorner(node);
        const origin = this.originOf(node);
        const corner = {
            x: parent.x + position.x - origin.x * own.width,
            y: parent.y + position.y - origin.y * own.height,
        };
        const kept = cornerInside(corner, own, bounds);
        return {
            x:
                kept.x === corner.x
                    ? position.x
                    : kept.x + origin.x * own.width - parent.x,
            y:
                kept.y === corner.y
                    ? position.y
                    : kept.y + origin.y * own.height - parent.y,
        };
    }

    /**
     * A node's own stacking value: its `zIndex`, raised when it is selected and
     * `elevateNodesOnSelect` is on.
     */
    private ownZ(node: FlowNode): number {
        const raised =
            node.selected === true &&
            (this.options.elevateNodesOnSelect ?? true);
        return zOf(node.zIndex) + (raised ? SELECTED_RAISE : 0);
    }

    /** A node's structural `z-index`: its own, and always above its parent's (0 for none). */
    private nodeZ(nodeId: string): number {
        // most nodes have no parent: no chain to walk (it is read per node on every pan frame)
        const first = this.node(nodeId);
        if (first === undefined) return 0;
        if (first.parentId === undefined) return this.ownZ(first);
        const chain: FlowNode[] = [];
        const seen = new Set<string>();
        for (
            let node: FlowNode | undefined = first;
            node !== undefined && !seen.has(node.id);
            node =
                node.parentId === undefined
                    ? undefined
                    : this.node(node.parentId)
        ) {
            seen.add(node.id);
            chain.push(node);
        }
        let z: number | undefined;
        for (const node of chain.reverse()) {
            const own = this.ownZ(node);
            z = z === undefined ? own : Math.max(own, z + 1);
        }
        return z ?? 0;
    }

    /** An edge's stacking value: its `zIndex`, raised when selected with `elevateEdgesOnSelect`. */
    private edgeZ(edge: FlowEdge): number {
        const raised =
            edge.selected === true &&
            (this.options.elevateEdgesOnSelect ?? false);
        return zOf(edge.zIndex) + (raised ? SELECTED_RAISE : 0);
    }

    private boundsOf(
        nodeIds: readonly unknown[] | undefined,
        includeHidden = false,
    ): Rect | undefined {
        const ids =
            nodeIds?.filter((id): id is string => typeof id === "string") ??
            this.model
                .get("all-nodes")
                .filter((node) => includeHidden || node.hidden !== true)
                .map((node) => node.id);
        return boundsOf(
            ids.flatMap((id) => {
                const rect = this.knownRect(id);
                return rect ? [rect] : [];
            }),
        );
    }

    /**
     * `intersecting-nodes`: the shown nodes of known size whose box shares area with a node's box
     * or a rectangle (`partial: false`: lies inside it), the node itself left out.
     */
    private intersectingNodes(payload: unknown): readonly FlowNode[] {
        const record = payloadRecord(payload);
        const nodeId =
            typeof record.nodeId === "string" ? record.nodeId : undefined;
        const rect = payloadRecord(record.rect);
        const area =
            nodeId !== undefined
                ? this.knownRect(nodeId)
                : finite(rect.x) &&
                    finite(rect.y) &&
                    finite(rect.width) &&
                    finite(rect.height) &&
                    rect.width >= 0 &&
                    rect.height >= 0
                  ? {
                        x: rect.x,
                        y: rect.y,
                        width: rect.width,
                        height: rect.height,
                    }
                  : undefined;
        if (!area) return [];
        const partial = record.partial !== false;
        return this.model.get("all-nodes").filter((node) => {
            if (node.id === nodeId || node.hidden === true) return false;
            const box = this.knownRect(node.id);
            if (!box) return false;
            return partial ? sharesArea(box, area) : contains(area, box);
        });
    }

    /** A handle with its absolute centre (once it and its node are measured). */
    private placed(handle: FlowHandle): FlowHandle {
        if (!handle.bounds) return handle;
        const rect = this.nodeRect(handle.nodeId);
        if (!rect) return handle;
        return {
            ...handle,
            center: {
                x: rect.x + handle.bounds.x + handle.bounds.width / 2,
                y: rect.y + handle.bounds.y + handle.bounds.height / 2,
            },
        };
    }

    private handles(): FlowHandle[] {
        return this.measurements
            .allHandles()
            .map((handle) => this.placed(handle));
    }

    /** A node's handle of a type and id (none: its first of that type); an id of the other type too. */
    private handleOf(
        nodeId: string,
        type: HandleType,
        handleId: string | undefined,
    ): FlowHandle | undefined {
        const own = this.measurements.handlesOf(nodeId);
        const found =
            handleId === undefined
                ? (own.find(
                      (handle) =>
                          handle.type === type && handle.handleId === undefined,
                  ) ?? own.find((handle) => handle.type === type))
                : (own.find(
                      (handle) =>
                          handle.type === type && handle.handleId === handleId,
                  ) ?? own.find((handle) => handle.handleId === handleId));
        return found ? this.placed(found) : undefined;
    }

    private edgePath(edgeId: string): EdgePath | undefined {
        const edge = this.model.get("edge-by", { id: edgeId });
        if (!edge) return undefined;
        const ends = edgeEnds(edge, {
            rect: (nodeId) => this.knownRect(nodeId),
            handle: (nodeId, type, handleId) =>
                this.handleOf(nodeId, type, handleId),
        });
        return ends
            ? pathOf(edge.type, ends, this.options.pathOptions ?? {})
            : undefined;
    }

    private view(): Rect | undefined {
        const size = this.rootSize();
        return size.width > 0 && size.height > 0
            ? viewRect(this.current, size)
            : undefined;
    }

    private visibleNodes(): readonly FlowNode[] {
        const view = this.view();
        return this.model.get("all-nodes").filter((node) => {
            if (node.hidden === true) return false;
            if (!view) return true;
            const rect = this.knownRect(node.id);
            return rect === undefined || overlaps(rect, view);
        });
    }

    private visibleEdges(): readonly FlowEdge[] {
        const view = this.view();
        return this.model.get("all-edges").filter((edge) => {
            if (edge.hidden === true) return false;
            if (this.node(edge.source)?.hidden === true) return false;
            if (this.node(edge.target)?.hidden === true) return false;
            const path = this.edgePath(edge.id);
            if (!path) return false;
            if (!view) return true;
            const box = boundsOf([
                { ...path.source, width: 0, height: 0 },
                { ...path.target, width: 0, height: 0 },
            ]) as Rect;
            return overlaps(box, view);
        });
    }

    /**
     * The edges an adapter draws, in drawing order: those shown whose nodes are measured (with
     * `onlyRenderVisible`, those in view), by their stacking value, the document's order among
     * equals.
     */
    private drawnEdges(): readonly FlowEdge[] {
        const shown =
            (this.options.onlyRenderVisible ?? false)
                ? this.visibleEdges()
                : this.model
                      .get("all-edges")
                      .filter(
                          (edge) =>
                              edge.hidden !== true &&
                              this.node(edge.source)?.hidden !== true &&
                              this.node(edge.target)?.hidden !== true &&
                              this.edgePath(edge.id) !== undefined,
                      );
        return shown
            .map((edge, i) => ({ edge, i, z: this.edgeZ(edge) }))
            .sort((a, b) => a.z - b.z || a.i - b.i)
            .map(({ edge }) => edge);
    }

    /**
     * Something was measured: the adapters hear it once per task (a mount registers many nodes and
     * handles in one commit), through the root window's microtask queue; without a root, now.
     */
    private measured(): void {
        if (this.measureQueued) return;
        const view = viewOf(this.rootElement);
        if (!view || typeof view.queueMicrotask !== "function") {
            this.flushMeasured();
            return;
        }
        this.measureQueued = true;
        view.queueMicrotask(() => {
            this.measureQueued = false;
            this.flushMeasured();
        });
    }

    private measureQueued = false;

    private readonly stopPrune: () => void;

    private flushMeasured(): void {
        if (this.destroyed) return;
        this.notify({ measured: true });
        if (!this.rootElement) return;
        const nodes = this.model
            .get("all-nodes")
            .filter((node) => node.hidden !== true);
        const all = nodes.every((node) => this.knownRect(node.id));
        const fit = this.pendingFit;
        if (fit && nodes.length > 0 && all && this.fitView(fit, false).ok) {
            this.pendingFit = undefined;
        }
        // ready once: a sized root, every shown node measured (and a pending fit done)
        const size = this.rootSize();
        if (
            !this.ready &&
            all &&
            size.width > 0 &&
            size.height > 0 &&
            (this.pendingFit === undefined || nodes.length === 0)
        ) {
            this.ready = true;
            // a reactive read of `is("ready")` sees it
            this.notify({ measured: true });
            this.emit({ type: "ready" });
        }
    }

    // ---------------------------------------------------------------------------------------------
    // notifications
    // ---------------------------------------------------------------------------------------------

    private notify(change: Partial<ViewChange>): void {
        if (this.destroyed) return;
        this.revision += 1;
        const full: ViewChange = {
            viewport: change.viewport ?? false,
            measured: change.measured ?? false,
            gesture: change.gesture ?? false,
        };
        for (const listener of [...this.adapterListeners]) listener(full);
    }

    private emit(event: FlowEngineEvent): void {
        if (this.destroyed) return;
        for (const listener of [...this.listeners]) listener(event);
    }

    private host(): FeatureEngineHost {
        return {
            model: this.model as unknown as FeatureModel,
            shared: <V>(key: string, create: () => V): V => {
                if (!this.shared.has(key)) this.shared.set(key, create());
                return this.shared.get(key) as V;
            },
            root: () => this.rootElement,
            viewport: () => this.current,
            zoomLimits: () => ({ min: this.minZoom, max: this.maxZoom }),
            setViewport: (viewport) => this.setViewport(viewport, true),
            rootSize: () => this.rootSize(),
            toRoot: (client) => this.toRoot(client),
            toFlow: (client) => this.toFlow(client),
            nodeRect: (nodeId) => this.nodeRect(nodeId),
            measured: (nodeId) => this.knownRect(nodeId) !== undefined,
            handles: () => this.handles(),
            edgePath: (edgeId) => this.edgePath(edgeId),
            absolutePosition: (nodeId) => {
                const node = this.node(nodeId);
                return node ? this.absolutePosition(node) : undefined;
            },
            positionFor: (nodeId, corner, size) =>
                this.positionFor(nodeId, corner, size),
            extentOf: (nodeId) => this.extentOf(nodeId),
            keepInExtent: (nodeId, position, size) =>
                this.keepInExtent(nodeId, position, size),
            held: (key, event) => this.held(key, event),
            nodeElement: (nodeId) => this.measurements.nodeElement(nodeId),
            interactive: () => this.interactivity.interactive,
            allows: (kind) => this.allows(kind),
            tapDistance: (on) => this.tapDistance(on),
            focusable: (kind) =>
                (kind === "node"
                    ? this.options.nodesFocusable
                    : this.options.edgesFocusable) !== false,
            toClient: (point) => this.toClient(point),
            path: (type, ends) =>
                pathOf(type, ends, this.options.pathOptions ?? {}),
            partOptions: (part, id) =>
                this.partOptions.get(`${part}\u0000${id}`),
            changed: () => this.notify({ gesture: true }),
            emit: (event) => this.emit(event),
        };
    }

    // ---------------------------------------------------------------------------------------------
    // the root's events
    // ---------------------------------------------------------------------------------------------

    private attachRoot(element: HTMLElement): void {
        if (this.rootElement === element) return;
        this.detachRoot();
        this.rootElement = element;
        // the browser must not take touches for its own scroll or zoom: they would cancel gestures
        writeRootTouchAction(element);
        const listeners: [string, EventListener, AddEventListenerOptions?][] = [
            ["pointerdown", (event) => this.pointerDown(event as PointerEvent)],
            ["pointermove", (event) => this.pointerMove(event as PointerEvent)],
            ["pointerup", (event) => this.pointerUp(event as PointerEvent)],
            [
                "pointercancel",
                (event) => this.pointerLost(event as PointerEvent),
            ],
            [
                "lostpointercapture",
                (event) => this.pointerLost(event as PointerEvent),
            ],
            [
                "wheel",
                (event) => this.wheel(event as WheelEvent),
                { passive: false },
            ],
            ["dblclick", (event) => this.doubleClick(event as MouseEvent)],
            ["keydown", (event) => this.keyDown(event as KeyboardEvent)],
            ["focusin", (event) => this.focusIn(event as FocusEvent)],
            ["contextmenu", (event) => this.contextMenu(event as MouseEvent)],
        ];
        for (const [type, listener, options] of listeners) {
            element.addEventListener(type, listener, options);
        }
        // the activation keys are held anywhere in the page, not only with focus in the flow
        const doc = element.ownerDocument;
        const view = viewOf(element);
        const keyListeners: [EventTarget | undefined, string, EventListener][] =
            [
                [
                    doc,
                    "keydown",
                    (event) => this.keyHeld(event as KeyboardEvent, true),
                ],
                [
                    doc,
                    "keyup",
                    (event) => this.keyHeld(event as KeyboardEvent, false),
                ],
                [view, "blur", () => this.heldKeys.clear()],
            ];
        for (const [target, type, listener] of keyListeners) {
            target?.addEventListener(type, listener);
        }
        this.removeRootListeners = () => {
            for (const [type, listener, options] of listeners) {
                element.removeEventListener(type, listener, options);
            }
            for (const [target, type, listener] of keyListeners) {
                target?.removeEventListener(type, listener);
            }
        };
        this.features.attached(element);
        this.measurements.measureAll();
        this.measured();
    }

    private detachRoot(): void {
        if (!this.rootElement) return;
        this.cancelPress();
        this.cancelFollowing();
        this.endPinch();
        this.stopWheelRest();
        this.released = undefined;
        // the frames are the root window's: another root may be in another window
        this.stopViewportAnimation();
        this.stopAutoPan();
        this.heldKeys.clear();
        this.blockContextMenu = false;
        this.pointers.clear();
        this.features.detached();
        this.removeRootListeners?.();
        this.removeRootListeners = undefined;
        clearRootTouchAction(this.rootElement);
        this.rootElement = undefined;
        this.settle(true);
    }

    private target(eventTarget: EventTarget | null): PressTarget {
        const root = this.rootElement;
        if (!root) return { kind: "other", element: undefined };
        return pressTargetOf(root, eventTarget, (element) =>
            this.measurements.handleOf(element, (handle) =>
                this.placed(handle),
            ),
        );
    }

    private capture(pointerId: number): void {
        try {
            this.rootElement?.setPointerCapture?.(pointerId);
        } catch {
            // a pointer that is no longer active cannot be captured: its moves still bubble here
        }
    }

    private release(pointerId: number): void {
        try {
            if (this.rootElement?.hasPointerCapture?.(pointerId)) {
                this.rootElement.releasePointerCapture(pointerId);
            }
        } catch {
            // already released
        }
    }

    private pointerDown(event: PointerEvent): void {
        if (this.destroyed) return;
        // the viewport changes of a press (the minimap centres on it) are one move with its drag
        this.handling++;
        try {
            this.pressDown(event);
        } finally {
            this.handling--;
            this.settle();
        }
    }

    private pressDown(event: PointerEvent): void {
        this.dropEnded();
        // a double click counts this press's release only (a press that starts nothing has none)
        this.released = undefined;
        const client = { x: event.clientX, y: event.clientY };
        // only touch pointers pinch: the others are never tracked
        if (event.pointerType === "touch") {
            this.pointers.set(event.pointerId, client);
        }
        if (this.pinch) return;
        let press = this.press;
        // a press whose release was missed (outside the root, its capture refused) ends where its
        // pointer was last seen, as if released there
        if (
            press &&
            (press.pointerId === event.pointerId ||
                event.pointerType !== "touch")
        ) {
            this.press = undefined;
            this.stopAutoPan();
            this.release(press.pointerId);
            if (press.last) press.gesture?.end(press.last);
            else press.gesture?.cancel();
            this.released = undefined;
            press = undefined;
        }
        if (press) {
            // a second finger on a pan (or a press that did nothing yet) pinches
            if (
                event.pointerType === "touch" &&
                (this.options.zoomOnPinch ?? true) &&
                (press.pan ||
                    press.gesture === undefined ||
                    press.gesture.active?.() !== true) &&
                this.pointers.size === 2
            ) {
                this.startPinch(press.pointerId, event.pointerId);
                event.preventDefault();
            }
            return;
        }
        if (event.isPrimary === false) return;
        this.blockContextMenu = false;
        // a touch or a pen presses as the primary button
        const button = event.pointerType === "mouse" ? event.button : 0;
        // a mouse button that does not pan starts nothing (a feature's gestures are primary)
        if (button !== 0 && !this.pansWith(button)) return;
        const target = this.target(event.target);
        if (target.kind === "other") {
            this.pointers.delete(event.pointerId);
            return;
        }
        let gesture: FeatureGesture | undefined;
        let pan = false;
        const keyPan = button === 0 && this.panKeyHeld(event);
        const following = button === 0 && !keyPan ? this.following : undefined;
        if (following) {
            // the gesture a tap started takes the next press: its release is the gesture's end
            this.following = undefined;
            gesture = following;
        } else if (keyPan) {
            // the pan activation key: a pan from anywhere, and no other gesture
            gesture = this.panGesture(client);
            pan = true;
        } else if (button !== 0) {
            if (target.kind !== "pane") return;
            gesture = this.panGesture(client);
            pan = true;
        } else {
            gesture = this.features.pointerdown(event, target);
            if (!gesture && target.kind === "pane" && this.pansWith(0)) {
                gesture = this.panGesture(client);
                pan = true;
            }
        }
        this.press = {
            pointerId: event.pointerId,
            start: client,
            target,
            gesture,
            pan,
            button,
            keyPan,
            follows: following !== undefined,
            travel: 0,
            menu: false,
            last: undefined,
        };
        this.capture(event.pointerId);
        // the pane's presses select no text; a node's keep their default (focus)
        if (target.kind !== "node" && target.kind !== "edge")
            event.preventDefault();
    }

    /** Whether a press of a mouse button (0 for a touch or a pen) pans the pane (`panOnDrag`). */
    private pansWith(button: number): boolean {
        const option = this.options.panOnDrag ?? true;
        return typeof option === "boolean"
            ? option && button === 0
            : option.includes(button);
    }

    /** Whether `key` is held now: a modifier as `event` tells it, any other from the document's keys. */
    private held(
        key: string | null,
        event: MouseEvent | KeyboardEvent,
    ): boolean {
        if (key === null || key === "") return false;
        const modifier = MODIFIERS[key];
        return modifier !== undefined
            ? event[modifier]
            : this.heldKeys.has(key);
    }

    private panKeyHeld(event: MouseEvent): boolean {
        const key = this.options.panActivationKey;
        return this.held(key === undefined ? " " : key, event);
    }

    private zoomKeyHeld(event: MouseEvent): boolean {
        const key = this.options.zoomActivationKey;
        if (key !== undefined) return this.held(key, event);
        const agent = viewOf(this.rootElement)?.navigator;
        const platform = `${agent?.platform ?? ""} ${agent?.userAgent ?? ""}`;
        return this.held(
            /Mac|iPhone|iPad|iPod/.test(platform) ? "Meta" : "Control",
            event,
        );
    }

    /** A key went down or up in the root's document: the activation keys read it. */
    private keyHeld(event: KeyboardEvent, down: boolean): void {
        this.dropEnded();
        // a connection a tap started waits without a press, often with focus outside the root (the
        // handle's press kept it from moving): Escape anywhere in the page cancels it
        if (down && event.key === "Escape" && this.following && !this.press) {
            this.cancelFollowing();
            event.preventDefault();
            return;
        }
        if (down) {
            // typing in a field (a node's, the page's) holds no activation key
            if (asElement(event.target)?.closest?.(EDITABLE)) return;
            this.heldKeys.add(event.key);
            this.heldKeys.add(event.code);
        } else {
            this.heldKeys.delete(event.key);
            this.heldKeys.delete(event.code);
        }
    }

    /**
     * A middle or right button pan keeps the context menu out while it is pressed (macOS and Linux
     * open it on press, before any move), and a right-button pan that moved after its release
     * (Windows opens it on release).
     */
    private contextMenu(event: MouseEvent): void {
        if (this.destroyed) return;
        const press = this.press;
        const panning = press?.pan === true && press.button !== 0;
        const blocked = panning || this.blockContextMenu;
        this.blockContextMenu = false;
        if (blocked) {
            event.preventDefault();
            return;
        }
        // during a captured press (a long press, Ctrl + click) the menu targets the root: it is
        // the press's, whose release is then no tap
        if (press) press.menu = true;
        this.emitPointer(
            "context-menu",
            press?.target ?? this.target(event.target),
            event,
        );
    }

    private panGesture(start: XY): FeatureGesture {
        // a pan takes the viewport over from an animation, where it is
        this.stopViewportAnimation();
        const origin = this.current;
        let moved = false;
        return {
            move: (event) => {
                const first = !moved;
                moved = true;
                this.setViewport(
                    {
                        x: origin.x + event.clientX - start.x,
                        y: origin.y + event.clientY - start.y,
                        zoom: origin.zoom,
                    },
                    true,
                );
                // the panning state changed once, on the first move
                if (first) this.notify({ gesture: true });
            },
            end: () => {
                if (moved) this.notify({ gesture: true });
            },
            cancel: () => {
                this.setViewport(origin, true);
                this.notify({ gesture: true });
            },
            active: () => (this.press?.travel ?? 0) > this.tapDistance("pane"),
        };
    }

    private pointerMove(event: PointerEvent): void {
        if (this.destroyed) return;
        this.dropEnded();
        const client = { x: event.clientX, y: event.clientY };
        if (this.pointers.has(event.pointerId))
            this.pointers.set(event.pointerId, client);
        if (this.pinch) {
            if (this.pinch.ids.includes(event.pointerId)) this.movePinch();
            return;
        }
        const press = this.press;
        if (!press) {
            // a gesture a tap started follows the pointer without a press
            if (event.isPrimary !== false) this.following?.move(event);
            return;
        }
        if (press.pointerId !== event.pointerId) return;
        press.travel = Math.max(press.travel, distance(press.start, client));
        press.last = event;
        press.gesture?.move(event);
        this.autoPan();
    }

    /** The auto-pan offset of the press under way now (zero when it does not auto-pan). */
    private autoPanNow(): XY {
        const press = this.press;
        const gesture = press?.gesture;
        if (
            !press?.last ||
            press.pan ||
            !autoPans(this.options.autoPan, gesture?.autoPan) ||
            gesture?.active?.() !== true
        ) {
            return { x: 0, y: 0 };
        }
        return autoPanOffset(
            this.toRoot({ x: press.last.clientX, y: press.last.clientY }),
            this.rootSize(),
            this.options.autoPan,
        );
    }

    /** Starts the auto-pan loop when the press's pointer is near the edge (one loop per engine). */
    private autoPan(): void {
        if (this.autoPanFrame || this.destroyed) return;
        const offset = this.autoPanNow();
        if (offset.x === 0 && offset.y === 0) return;
        const view = viewOf(this.rootElement);
        if (!view || typeof view.requestAnimationFrame !== "function") return;
        const id = view.requestAnimationFrame(() => {
            this.autoPanFrame = undefined;
            this.autoPanStep();
        });
        this.autoPanFrame = { view, id };
    }

    /**
     * One auto-pan frame: the viewport pans, and the gesture moves again with its last pointer
     * event (the flow point under the still pointer changed). It stops at the translate extent and
     * when the pointer leaves the edge; the next move starts it again.
     */
    private autoPanStep(): void {
        const offset = this.autoPanNow();
        const last = this.press?.last;
        if (!last || (offset.x === 0 && offset.y === 0)) return;
        const before = this.current;
        const after = this.setViewport(
            {
                x: before.x + offset.x,
                y: before.y + offset.y,
                zoom: before.zoom,
            },
            true,
        );
        if (sameViewport(before, after)) return;
        this.press?.gesture?.move(last);
        this.autoPan();
    }

    private stopAutoPan(): void {
        const frame = this.autoPanFrame;
        this.autoPanFrame = undefined;
        if (frame) frame.view.cancelAnimationFrame(frame.id);
    }

    private pointerUp(event: PointerEvent): void {
        if (this.destroyed) return;
        this.pointers.delete(event.pointerId);
        if (this.pinch) {
            if (this.pinch.ids.includes(event.pointerId)) this.endPinch();
            return;
        }
        const press = this.press;
        if (!press || press.pointerId !== event.pointerId) return;
        this.press = undefined;
        this.stopAutoPan();
        this.release(event.pointerId);
        const active = press.gesture?.active?.() ?? false;
        press.gesture?.end(event);
        const within = press.travel <= this.tapDistanceOf(press.target);
        if (press.button !== 0) {
            // the context menu a moved right-button pan's release opens stays out
            this.blockContextMenu = press.pan && press.button === 2 && !within;
            this.settle();
            return;
        }
        // a tap: released within the tap distance, no gesture started, not a key pan nor the
        // release of a connection a tap began (click-to-connect)
        const tap =
            !press.keyPan && !press.follows && !press.menu && !active && within;
        this.released = { target: press.target, tap };
        if (tap) {
            if (this.interactivity.interactive) {
                const taken = this.features.tap(event, press.target);
                if (typeof taken === "object") {
                    this.cancelFollowing();
                    this.following = taken;
                }
            }
            this.emitPointer("click", press.target, event);
        }
        this.settle();
    }

    /**
     * Tells the app a tap, a double click or a context menu on a node, an edge or the pane
     * (`node-click`, `edge-double-click`, `pane-context-menu`, …); several selected nodes take a
     * context menu as the selection's (`selection-context-menu`).
     */
    private emitPointer(
        what: "click" | "double-click" | "context-menu",
        target: PressTarget,
        event: MouseEvent,
    ): void {
        const on = tapOn(target);
        if (!on) return;
        const client = { x: event.clientX, y: event.clientY };
        const info: FlowPointerInfo = {
            point: this.toFlow(client),
            client,
            event,
        };
        if (on.kind === "pane") {
            this.emit({ type: `pane-${what}`, ...info });
            return;
        }
        if (on.kind === "edge") {
            this.emit({ type: `edge-${what}`, edgeId: on.edgeId, ...info });
            return;
        }
        if (what === "context-menu") {
            const nodes =
                (this.model.get("selected-nodes") as
                    | readonly FlowNode[]
                    | undefined) ?? [];
            if (
                nodes.length > 1 &&
                nodes.some((node) => node.id === on.nodeId)
            ) {
                const edges =
                    (this.model.get("selected-edges") as
                        | readonly FlowEdge[]
                        | undefined) ?? [];
                this.emit({
                    type: "selection-context-menu",
                    nodeIds: nodes.map((node) => node.id),
                    edgeIds: edges.map((edge) => edge.id),
                    ...info,
                });
                return;
            }
        }
        this.emit({ type: `node-${what}`, nodeId: on.nodeId, ...info });
    }

    private pointerLost(event: PointerEvent): void {
        if (this.destroyed) return;
        this.pointers.delete(event.pointerId);
        if (this.pinch?.ids.includes(event.pointerId)) {
            this.endPinch();
            return;
        }
        if (this.press?.pointerId === event.pointerId) {
            this.released = undefined;
            this.cancelPress();
        }
    }

    /**
     * Forgets a gesture going on without a press that ended by itself (a keyboard connection whose
     * handle lost focus or whose node went away): its `active()` answers false.
     */
    private dropEnded(): void {
        if (this.following?.active?.() === false) this.following = undefined;
    }

    /** Ends the gesture a tap started without committing. */
    private cancelFollowing(): void {
        const following = this.following;
        this.following = undefined;
        following?.cancel();
    }

    /** Ends the press under way without committing (its gesture cancelled). */
    private cancelPress(): void {
        const press = this.press;
        if (!press) return;
        this.press = undefined;
        this.stopAutoPan();
        this.release(press.pointerId);
        press.gesture?.cancel();
        this.settle();
    }

    private startPinch(first: number, second: number): void {
        const a = this.pointers.get(first);
        const b = this.pointers.get(second);
        if (!a || !b) return;
        // the press's gesture (a pan) gives way: the pinch pans and zooms from here
        const press = this.press;
        this.press = undefined;
        this.stopAutoPan();
        this.stopViewportAnimation();
        if (press && !press.pan) press.gesture?.cancel();
        const middle = this.toRoot({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        this.pinch = {
            ids: [first, second],
            distance: Math.max(1, distance(a, b)),
            zoom: this.current.zoom,
            anchor: toFlow(this.current, middle),
        };
        this.capture(second);
        this.notify({ gesture: true });
    }

    private movePinch(): void {
        const pinch = this.pinch;
        if (!pinch) return;
        const a = this.pointers.get(pinch.ids[0]);
        const b = this.pointers.get(pinch.ids[1]);
        if (!a || !b) return;
        // the zoom grows with the fingers' spread since the pinch began
        const zoom = clampZoom(
            (pinch.zoom * distance(a, b)) / pinch.distance,
            this.minZoom,
            this.maxZoom,
        );
        const middle = this.toRoot({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        // the flow point first under the fingers' middle stays under it
        this.setViewport(
            {
                x: middle.x - pinch.anchor.x * zoom,
                y: middle.y - pinch.anchor.y * zoom,
                zoom,
            },
            true,
        );
    }

    private endPinch(): void {
        const pinch = this.pinch;
        if (!pinch) return;
        this.pinch = undefined;
        this.released = undefined;
        for (const id of pinch.ids) this.release(id);
        this.notify({ gesture: true });
        this.settle();
    }

    private wheel(event: WheelEvent): void {
        if (this.destroyed || !this.rootElement) return;
        const element = event.target as Element | null;
        if (element?.closest?.(`[${NO_WHEEL_ATTRIBUTE}]`)) return;
        // the wheel's viewport changes are one move, until it rests
        const before = this.moving;
        this.handling++;
        try {
            this.wheelOn(event);
        } finally {
            this.handling--;
            if (this.moving) this.restWheel();
            else if (before) this.settle();
        }
    }

    private wheelOn(event: WheelEvent): void {
        const target = this.target(event.target);
        if (this.features.wheel(event, target)) {
            event.preventDefault();
            return;
        }
        // a control, a toolbar or a panel keeps its wheel (a field scrolls)
        if (target.kind === "other") return;
        // the page never scrolls under the flow, whatever the wheel does there
        if (this.options.preventScrolling ?? true) event.preventDefault();
        const scale =
            event.deltaMode === 1
                ? 16
                : event.deltaMode === 2
                  ? this.rootSize().height || 800
                  : 1;
        const dx = event.deltaX * scale;
        const dy = event.deltaY * scale;
        const pinching = event.ctrlKey;
        const panOnScroll = this.options.panOnScroll ?? false;
        const point = this.toRoot({ x: event.clientX, y: event.clientY });
        // with panOnScroll, the zoom activation key held turns the wheel back into a zoom
        const zoomKey = panOnScroll && this.zoomKeyHeld(event);
        if (
            zoomKey ||
            (pinching ? (this.options.zoomOnPinch ?? true) : !panOnScroll)
        ) {
            if (!zoomKey && !pinching && !(this.options.zoomOnScroll ?? true))
                return;
            event.preventDefault();
            // a trackpad's pinch sends small deltas: it zooms faster per pixel than a wheel
            const zoom =
                this.current.zoom *
                Math.exp(-dy / (pinching ? WHEEL_PINCH_RATE : WHEEL_RATE));
            this.setViewport(
                zoomAround(
                    this.current,
                    clampZoom(zoom, this.minZoom, this.maxZoom),
                    point,
                ),
                true,
            );
            return;
        }
        if (panOnScroll) {
            event.preventDefault();
            // Shift turns a wheel without a sideways delta sideways; the mode keeps one axis
            const mode = this.options.panOnScrollMode ?? "free";
            const sideways = event.shiftKey && dx === 0 && mode !== "vertical";
            const speed = this.options.panOnScrollSpeed ?? 1;
            const byX = mode === "vertical" ? 0 : sideways ? dy : dx;
            const byY = mode === "horizontal" || sideways ? 0 : dy;
            this.setViewport(
                {
                    ...this.current,
                    x: this.current.x - byX * speed,
                    y: this.current.y - byY * speed,
                },
                true,
            );
        }
    }

    /**
     * A double click. With the pointer captured on the root, a browser's `dblclick` targets the
     * root: what it was on is the last press's target, and it counts (`*-double-click`) only when
     * that press was a tap (a double click ending a drag is none). A double click with no press
     * seen (a synthetic one) is read from its own target; one on a control is the control's.
     */
    private doubleClick(event: MouseEvent): void {
        if (this.destroyed) return;
        if (this.target(event.target).kind === "other") return;
        const released = this.released;
        const target = released?.target ?? this.target(event.target);
        const tap = released?.tap ?? true;
        if (!tap) return;
        this.emitPointer("double-click", target, event);
        if (!(this.options.zoomOnDoubleClick ?? true)) return;
        if (target.kind !== "pane") return;
        const point = this.toRoot({ x: event.clientX, y: event.clientY });
        const zoom = clampZoom(
            this.current.zoom * 2,
            this.minZoom,
            this.maxZoom,
        );
        this.setViewport(zoomAround(this.current, zoom, point), true);
    }

    private keyDown(event: KeyboardEvent): void {
        if (this.destroyed) return;
        this.dropEnded();
        if (
            event.key === "Escape" &&
            (this.press || this.pinch || this.following)
        ) {
            this.cancelPress();
            this.cancelFollowing();
            this.endPinch();
            event.preventDefault();
            return;
        }
        // a gesture going on without a press (a keyboard connection) takes the keys first
        const following = this.following;
        if (following?.keydown) {
            const taken = following.keydown(event);
            if (
                this.following === following &&
                following.active?.() === false
            ) {
                this.following = undefined;
            }
            if (taken) {
                event.preventDefault();
                return;
            }
        }
        const target = this.target(event.target);
        if (target.kind === "other") return;
        const taken = this.features.keydown(event, target);
        if (typeof taken === "object") {
            this.cancelFollowing();
            this.following = taken;
        }
        if (taken) event.preventDefault();
    }

    private focusIn(event: FocusEvent): void {
        if (this.destroyed) return;
        const target = this.target(event.target);
        if (target.kind === "node" || target.kind === "edge")
            this.features.focus(target);
    }

    // ---------------------------------------------------------------------------------------------
    // the adapter
    // ---------------------------------------------------------------------------------------------

    private attributes(
        part: string,
        payload: Readonly<Record<string, unknown>>,
    ): PartAttributes {
        const into: MutablePartAttributes = { [PART_ATTRIBUTE]: part };
        const id = (key: string) =>
            typeof payload[key] === "string"
                ? (payload[key] as string)
                : undefined;
        switch (part) {
            case "root":
                into["data-interactive"] = flag(this.interactivity.interactive);
                into["data-panning"] = flag(this.is("panning"));
                break;
            case "node":
            case "minimap-node":
            case "toolbar":
            case "resizer": {
                const nodeId = id("nodeId");
                const node =
                    nodeId === undefined ? undefined : this.node(nodeId);
                // an edge's toolbar stands for its edge
                into[ID_ATTRIBUTE] =
                    nodeId ?? (part === "toolbar" ? id("edgeId") : undefined);
                if (part !== "resizer" && part !== "toolbar") {
                    into["data-selected"] = flag(node?.selected === true);
                }
                if (part === "node") {
                    into["data-hidden"] = flag(node?.hidden === true);
                    into["data-measured"] = flag(
                        nodeId !== undefined &&
                            this.knownRect(nodeId) !== undefined,
                    );
                }
                break;
            }
            case "edge":
            case "edge-path":
            case "edge-label": {
                const edgeId = id("edgeId");
                const edge =
                    edgeId === undefined
                        ? undefined
                        : this.model.get("edge-by", { id: edgeId });
                into[ID_ATTRIBUTE] = edgeId;
                into["data-selected"] = flag(edge?.selected === true);
                break;
            }
            case "handle": {
                into[ID_ATTRIBUTE] = id("handleId");
                into["data-handle-type"] = id("type");
                into["data-side"] = id("side");
                const nodeId = id("nodeId");
                const connectable =
                    payload.connectable !== false &&
                    nodeId !== undefined &&
                    this.model.is("node-connectable", { nodeId });
                into["data-connectable"] = flag(connectable);
                into["data-connectable-start"] = flag(
                    connectable && payload.connectableStart !== false,
                );
                into["data-connectable-end"] = flag(
                    connectable && payload.connectableEnd !== false,
                );
                break;
            }
            case "resize-handle":
                into[POSITION_ATTRIBUTE] = id("position");
                break;
            case "reconnect-anchor":
                into[ID_ATTRIBUTE] = id("edgeId");
                into[END_ATTRIBUTE] = id("end");
                break;
        }
        this.features.attributes(part, payload, into);
        return Object.freeze(into);
    }

    private createAdapter(): FlowEngineAdapter {
        const engine = this;
        return Object.freeze({
            model: this.model,
            get settings() {
                return Object.freeze({
                    onlyRenderVisible:
                        engine.options.onlyRenderVisible ?? false,
                });
            },
            setOptions: (options) => {
                if (this.destroyed) return;
                const {
                    root: _root,
                    defaultViewport: _viewport,
                    fitView: _fit,
                    ...rest
                } = options;
                this.options = { ...this.options, ...rest };
                this.minZoom = this.options.minZoom ?? 0.5;
                this.maxZoom = Math.max(
                    this.minZoom,
                    this.options.maxZoom ?? 2,
                );
                if (
                    rest.interactive !== undefined &&
                    rest.interactive !== this.interactivity.interactive
                ) {
                    this.run("set-interactive", {
                        interactive: rest.interactive,
                    });
                }
                // the viewport kept to the new limits and extent
                this.setViewport(this.current, false);
                this.notify({ viewport: true, measured: true, gesture: true });
            },
            attachRoot: (element) => {
                if (!this.destroyed) this.attachRoot(element);
            },
            detachRoot: () => this.detachRoot(),
            attachViewport: (element) => {
                if (this.destroyed || this.viewportElement === element) return;
                if (this.viewportElement)
                    clearViewportTransform(this.viewportElement);
                this.viewportElement = element ?? undefined;
                if (element) writeViewportTransform(element, this.current);
            },
            registerNode: (nodeId, element) => {
                if (!this.destroyed)
                    this.measurements.registerNode(nodeId, element);
            },
            registerHandle: (handle: HandleRegistration, element) => {
                if (!this.destroyed)
                    this.measurements.registerHandle(handle, element);
            },
            setPartOptions: (part, id, options) => {
                const key = `${part}\u0000${id}`;
                if (options)
                    this.partOptions.set(key, Object.freeze({ ...options }));
                else this.partOptions.delete(key);
            },
            attributes: ((
                part: string,
                payload?: Readonly<Record<string, unknown>>,
            ) =>
                this.attributes(
                    part,
                    payload ?? {},
                )) as FlowEngineAdapter["attributes"],
            subscribe: (listener) => {
                const wrapper = (change: ViewChange) => listener(change);
                this.adapterListeners.add(wrapper);
                return () => {
                    this.adapterListeners.delete(wrapper);
                };
            },
            getSnapshot: () => this.revision,
        } satisfies FlowEngineAdapter);
    }
}

/**
 * Creates the engine of one flow on screen, over its model
 * (`createFlowEngine<Types, typeof features>(model, options)`). Give it the root element now or
 * attach it later (`engine.adapter.attachRoot`, what an adapter does); call `destroy()` when the
 * flow leaves the screen.
 */
export function createFlowEngine<
    T extends FlowTypes = AnyTypes,
    const F extends FlowFeatures = readonly [],
>(model: FlowModel<T, F>, options: FlowEngineOptions = {}): FlowEngine<T, F> {
    const engine = new Engine<T, F>(model, options);
    // the surface is exactly the verbs, `subscribe`, `destroy` and `adapter`, each bound
    return Object.freeze({
        run: engine.run.bind(engine),
        can: engine.can.bind(engine),
        check: engine.check.bind(engine),
        get: engine.get.bind(engine),
        is: engine.is.bind(engine),
        subscribe: engine.subscribe.bind(engine),
        destroy: engine.destroy.bind(engine),
        adapter: engine.adapter,
    }) as unknown as FlowEngine<T, F>;
}
