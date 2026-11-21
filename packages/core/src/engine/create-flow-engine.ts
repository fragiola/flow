// The flow engine (D4, D8-D13): one flow on screen. It owns the viewport (written to its element
// directly), measures nodes and handles with the root window's `ResizeObserver`, draws edges'
// paths, and runs every gesture on Pointer Events with capture (pan, pinch, the features' drags),
// the wheel and the keys, behind the same five verbs as the model; the installed features add
// theirs. It changes the flow only by running the model's commands, so every middleware sees what
// a drag, a connection or a key does. It never touches the global `document` or `window`: every
// DOM access goes through the root element (its `ownerDocument`, its `defaultView`).
import {
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
import { boundsOf, overlaps } from "../geometry/rect";
import type { EdgePath, Rect, Viewport } from "../geometry/types";
import {
    centeredOn,
    clampZoom,
    fitBounds,
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
import { backgroundPattern } from "./background-pattern";
import { pressTargetOf } from "./dom";
import { edgeEnds, type PathOptions, pathOf } from "./edge-geometry";
import type { FlowEngineEvent } from "./events";
import { Measurements } from "./measurements";
import { nodeToolbarPosition } from "./node-toolbar";
import {
    clearViewportTransform,
    writeViewportTransform,
} from "./structural-style";
import type {
    BackgroundPatternPayload,
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
    /** a drag on the pane pans; default true */
    panOnDrag?: boolean | undefined;
    /** the wheel pans (Ctrl + wheel zooms); default false: the wheel zooms */
    panOnScroll?: boolean | undefined;
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

/** How far (in pixels) a press may move and still be a tap. */
const TAP_TOLERANCE = 3;

/** A press under way: its pointer, where it started, and the gesture that took it. */
interface Press {
    readonly pointerId: number;
    readonly start: XY;
    readonly target: PressTarget;
    readonly gesture: FeatureGesture | undefined;
    readonly pan: boolean;
    travel: number;
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

class Engine<T extends FlowTypes, F extends FlowFeatures> {
    readonly model: FlowModel;
    readonly adapter: FlowEngineAdapter;
    private readonly options: FlowEngineOptions;
    private readonly minZoom: number;
    private readonly maxZoom: number;
    private readonly measurements: Measurements;
    private readonly features: ComposedFeatureEngine;
    private readonly shared = new Map<string, unknown>();
    private readonly partOptions = new Map<
        string,
        Readonly<Record<string, unknown>>
    >();
    private readonly edges = new Map<string, Element>();
    private readonly listeners = new Set<(event: FlowEngineEvent) => void>();
    private readonly adapterListeners = new Set<(change: ViewChange) => void>();
    private readonly actions: Record<
        Exclude<EngineActionKey, OwnedBy<"engineRun">>,
        ActionHandler
    >;
    private current: Viewport;
    private interactive: boolean;
    private rootElement: HTMLElement | undefined;
    private viewportElement: HTMLElement | SVGElement | undefined;
    private removeRootListeners: (() => void) | undefined;
    private press: Press | undefined;
    private pinch: Pinch | undefined;
    private readonly pointers = new Map<number, XY>();
    private pendingFit: FitViewPayload | undefined;
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
        this.interactive = options.interactive ?? true;
        this.pendingFit =
            options.fitView === true
                ? {}
                : options.fitView === false
                  ? undefined
                  : options.fitView;
        this.measurements = new Measurements(
            () => this.current.zoom,
            () => this.measured(),
        );
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
                return this.apply(
                    zoomAround(
                        this.current,
                        clampZoom(zoom, this.minZoom, this.maxZoom),
                        pointOf(around) ?? this.center(),
                    ),
                    dryRun,
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
                );
            },
            "focus-node": (payload, dryRun) => this.focusNode(payload, dryRun),
            "set-interactive": (payload, dryRun) => {
                const { interactive } = payloadRecord(payload);
                if (typeof interactive !== "boolean") {
                    return fail(
                        "invalid_payload",
                        "interactive must be a boolean",
                        "/interactive",
                    );
                }
                if (!dryRun && interactive !== this.interactive) {
                    if (!interactive) this.cancelPress();
                    this.interactive = interactive;
                    this.notify({ gesture: true });
                }
                return ok({ interactive });
            },
            "cancel-gesture": (_payload, dryRun) => {
                if (!this.press && !this.pinch) {
                    return fail("refused", "no gesture is under way");
                }
                if (!dryRun) {
                    this.cancelPress();
                    this.endPinch();
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
            "screen-to-flow": (p) => {
                const point = pointOf(p);
                return point ? this.toFlow(point) : undefined;
            },
            "flow-to-screen": (p) => {
                const point = pointOf(p);
                if (!point) return undefined;
                const box = this.rootBox();
                const screen = toScreen(this.current, point);
                return { x: screen.x + box.x, y: screen.y + box.y };
            },
            "visible-nodes": () => this.visibleNodes(),
            "visible-edges": () => this.visibleEdges(),
            "handles-by": (p) => {
                const nodeId = String(payloadRecord(p).nodeId);
                return this.handles().filter(
                    (handle) => handle.nodeId === nodeId,
                );
            },
            "background-pattern": (p) =>
                backgroundPattern(
                    this.current,
                    payloadRecord(p) as BackgroundPatternPayload,
                ),
            "node-toolbar-by": (p) => {
                const request = payloadRecord(
                    p,
                ) as unknown as NodeToolbarPayload;
                const rect = this.knownRect(String(request.nodeId));
                return rect
                    ? nodeToolbarPosition(rect, this.current, request)
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
            interactive: () => this.interactive,
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
        this.destroyed = true;
        this.features.destroy();
        if (this.viewportElement) clearViewportTransform(this.viewportElement);
        this.viewportElement = undefined;
        this.measurements.destroy();
        this.edges.clear();
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
        const next = this.kept(viewport);
        if (sameViewport(next, this.current)) return this.current;
        this.current = Object.freeze(next);
        if (this.viewportElement) {
            writeViewportTransform(this.viewportElement, this.current);
        }
        this.notify({ viewport: true });
        this.emit({ type: "viewport-change", viewport: this.current, gesture });
        return this.current;
    }

    private apply(viewport: Viewport, dryRun: boolean): CommandResult<unknown> {
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
        return ok(
            dryRun ? this.kept(viewport) : this.setViewport(viewport, false),
        );
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
        return this.apply(
            {
                x: (record.x as number | undefined) ?? this.current.x,
                y: (record.y as number | undefined) ?? this.current.y,
                zoom: (record.zoom as number | undefined) ?? this.current.zoom,
            },
            dryRun,
        );
    }

    private zoomStep(
        payload: unknown,
        dryRun: boolean,
        direction: 1 | -1,
    ): CommandResult<unknown> {
        const { step, around } = payloadRecord(payload) as ZoomStepPayload;
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
        );
    }

    private fitView(
        payload: FitViewPayload,
        dryRun: boolean,
    ): CommandResult<unknown> {
        const size = this.rootSize();
        if (size.width <= 0 || size.height <= 0) {
            return fail("refused", "the root has no size yet");
        }
        const bounds = this.boundsOf(payload.nodeIds);
        if (!bounds) return fail("refused", "no node has a size yet");
        const viewport = fitBounds(
            bounds,
            size,
            payload.padding ?? 0.1,
            payload.minZoom ?? this.minZoom,
            payload.maxZoom ?? this.maxZoom,
        );
        return this.apply(viewport, dryRun);
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

    private positionOf(nodeId: string): XY | undefined {
        return this.model.get("absolute-position-by", { nodeId });
    }

    /** A node's absolute box, its size zero until known. */
    private nodeRect(nodeId: string): Rect | undefined {
        const node = this.node(nodeId);
        const position = node && this.positionOf(nodeId);
        if (!node || !position) return undefined;
        const size = this.sizeOf(node) ?? ZERO_SIZE;
        return {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
        };
    }

    /** A node's absolute box, once its size is known. */
    private knownRect(nodeId: string): Rect | undefined {
        const node = this.node(nodeId);
        const size = node && this.sizeOf(node);
        const position = size && this.positionOf(nodeId);
        return size && position
            ? {
                  x: position.x,
                  y: position.y,
                  width: size.width,
                  height: size.height,
              }
            : undefined;
    }

    private boundsOf(
        nodeIds: readonly unknown[] | undefined,
    ): Rect | undefined {
        const ids =
            nodeIds?.filter((id): id is string => typeof id === "string") ??
            this.model
                .get("all-nodes")
                .filter((node) => node.hidden !== true)
                .map((node) => node.id);
        return boundsOf(
            ids.flatMap((id) => {
                const rect = this.knownRect(id);
                return rect ? [rect] : [];
            }),
        );
    }

    /** A handle with its absolute centre (once it and its node are measured). */
    private placed(handle: FlowHandle): FlowHandle {
        if (!handle.bounds) return handle;
        const position = this.positionOf(handle.nodeId);
        if (!position) return handle;
        return {
            ...handle,
            center: {
                x: position.x + handle.bounds.x + handle.bounds.width / 2,
                y: position.y + handle.bounds.y + handle.bounds.height / 2,
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
        const own = this.measurements
            .allHandles()
            .filter((handle) => handle.nodeId === nodeId);
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

    /** A node's position kept inside its parent's measured box (`extent: "parent"`). */
    private keepInParent(nodeId: string, position: XY, size?: Size): XY {
        const node = this.node(nodeId);
        if (
            !node ||
            node.parentId === undefined ||
            node.extent !== "parent" ||
            node.expandParent === true
        ) {
            return position;
        }
        const parent = this.node(node.parentId);
        if (!parent) return position;
        const room = this.sizeOf(parent);
        const own = size ?? this.sizeOf(node) ?? ZERO_SIZE;
        const clamp = (value: number, max: number) =>
            Math.min(Math.max(value, 0), Math.max(0, max));
        return {
            x: clamp(
                position.x,
                (room?.width ?? Number.POSITIVE_INFINITY) - own.width,
            ),
            y: clamp(
                position.y,
                (room?.height ?? Number.POSITIVE_INFINITY) - own.height,
            ),
        };
    }

    private measured(): void {
        this.notify({ measured: true });
        const fit = this.pendingFit;
        if (!fit || !this.rootElement) return;
        const nodes = this.model
            .get("all-nodes")
            .filter((node) => node.hidden !== true);
        if (
            nodes.length === 0 ||
            nodes.some((node) => !this.knownRect(node.id))
        )
            return;
        if (this.fitView(fit, false).ok) this.pendingFit = undefined;
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
            keepInParent: (nodeId, position, size) =>
                this.keepInParent(nodeId, position, size),
            nodeElement: (nodeId) => this.measurements.nodeElement(nodeId),
            interactive: () => this.interactive,
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
        ];
        for (const [type, listener, options] of listeners) {
            element.addEventListener(type, listener, options);
        }
        this.removeRootListeners = () => {
            for (const [type, listener, options] of listeners) {
                element.removeEventListener(type, listener, options);
            }
        };
        this.features.attached(element);
        this.measurements.measureAll();
        this.measured();
    }

    private detachRoot(): void {
        if (!this.rootElement) return;
        this.cancelPress();
        this.endPinch();
        this.pointers.clear();
        this.features.detached();
        this.removeRootListeners?.();
        this.removeRootListeners = undefined;
        this.rootElement = undefined;
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
        const client = { x: event.clientX, y: event.clientY };
        this.pointers.set(event.pointerId, client);
        if (this.pinch) return;
        const press = this.press;
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
        if (event.pointerType === "mouse" && event.button !== 0) return;
        const target = this.target(event.target);
        if (target.kind === "other") return;
        let gesture = this.features.pointerdown(event, target);
        let pan = false;
        if (
            !gesture &&
            target.kind === "pane" &&
            (this.options.panOnDrag ?? true)
        ) {
            gesture = this.panGesture(client);
            pan = true;
        }
        this.press = {
            pointerId: event.pointerId,
            start: client,
            target,
            gesture,
            pan,
            travel: 0,
        };
        this.capture(event.pointerId);
        // the pane's presses select no text; a node's keep their default (focus)
        if (target.kind !== "node" && target.kind !== "edge")
            event.preventDefault();
    }

    private panGesture(start: XY): FeatureGesture {
        const origin = this.current;
        let moved = false;
        return {
            move: (event) => {
                moved = true;
                this.setViewport(
                    {
                        x: origin.x + event.clientX - start.x,
                        y: origin.y + event.clientY - start.y,
                        zoom: origin.zoom,
                    },
                    true,
                );
                this.notify({ gesture: true });
            },
            end: () => {
                if (moved) this.notify({ gesture: true });
            },
            cancel: () => {
                this.setViewport(origin, true);
                this.notify({ gesture: true });
            },
            active: () => (this.press?.travel ?? 0) > TAP_TOLERANCE,
        };
    }

    private pointerMove(event: PointerEvent): void {
        if (this.destroyed) return;
        const client = { x: event.clientX, y: event.clientY };
        if (this.pointers.has(event.pointerId))
            this.pointers.set(event.pointerId, client);
        if (this.pinch) {
            if (this.pinch.ids.includes(event.pointerId)) this.movePinch();
            return;
        }
        const press = this.press;
        if (!press || press.pointerId !== event.pointerId) return;
        press.travel = Math.max(press.travel, distance(press.start, client));
        press.gesture?.move(event);
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
        this.release(event.pointerId);
        const active = press.gesture?.active?.() ?? false;
        press.gesture?.end(event);
        if (!active && press.travel <= TAP_TOLERANCE && this.interactive) {
            this.features.tap(event, press.target);
        }
    }

    private pointerLost(event: PointerEvent): void {
        if (this.destroyed) return;
        if (event.type === "pointercancel")
            this.pointers.delete(event.pointerId);
        if (this.pinch?.ids.includes(event.pointerId)) {
            this.endPinch();
            return;
        }
        if (this.press?.pointerId === event.pointerId) this.cancelPress();
    }

    /** Ends the press under way without committing (its gesture cancelled). */
    private cancelPress(): void {
        const press = this.press;
        if (!press) return;
        this.press = undefined;
        this.release(press.pointerId);
        press.gesture?.cancel();
    }

    private startPinch(first: number, second: number): void {
        const a = this.pointers.get(first);
        const b = this.pointers.get(second);
        if (!a || !b) return;
        // the press's gesture (a pan) gives way: the pinch pans and zooms from here
        const press = this.press;
        this.press = undefined;
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
        for (const id of pinch.ids) this.release(id);
        this.notify({ gesture: true });
    }

    private wheel(event: WheelEvent): void {
        if (this.destroyed || !this.rootElement) return;
        const element = event.target as Element | null;
        if (element?.closest?.(`[${NO_WHEEL_ATTRIBUTE}]`)) return;
        const target = this.target(event.target);
        if (this.features.wheel(event, target)) {
            event.preventDefault();
            return;
        }
        const scale =
            event.deltaMode === 1
                ? 16
                : event.deltaMode === 2
                  ? this.rootSize().height || 800
                  : 1;
        const dx = event.deltaX * scale;
        const dy = event.deltaY * scale;
        const pinching = event.ctrlKey;
        const point = this.toRoot({ x: event.clientX, y: event.clientY });
        if (
            pinching
                ? (this.options.zoomOnPinch ?? true)
                : !(this.options.panOnScroll ?? false)
        ) {
            if (!pinching && !(this.options.zoomOnScroll ?? true)) return;
            event.preventDefault();
            // a trackpad's pinch sends small deltas: it zooms faster per pixel than a wheel
            const zoom =
                this.current.zoom * 2 ** (-dy * (pinching ? 0.01 : 0.002));
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
        if (this.options.panOnScroll ?? false) {
            event.preventDefault();
            const horizontal = event.shiftKey && dx === 0;
            this.setViewport(
                {
                    ...this.current,
                    x: this.current.x - (horizontal ? dy : dx),
                    y: this.current.y - (horizontal ? 0 : dy),
                },
                true,
            );
        }
    }

    private doubleClick(event: MouseEvent): void {
        if (this.destroyed || !(this.options.zoomOnDoubleClick ?? true)) return;
        if (this.target(event.target).kind !== "pane") return;
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
        if (event.key === "Escape" && (this.press || this.pinch)) {
            this.cancelPress();
            this.endPinch();
            event.preventDefault();
            return;
        }
        const target = this.target(event.target);
        if (target.kind === "other") return;
        if (this.features.keydown(event, target)) event.preventDefault();
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
                into["data-interactive"] = flag(this.interactive);
                into["data-panning"] = flag(this.is("panning"));
                break;
            case "node":
            case "minimap-node":
            case "toolbar":
            case "resizer": {
                const nodeId = id("nodeId");
                const node =
                    nodeId === undefined ? undefined : this.node(nodeId);
                into[ID_ATTRIBUTE] = nodeId;
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
                into["data-connectable"] = flag(
                    payload.connectable !== false &&
                        nodeId !== undefined &&
                        this.model.is("node-connectable", { nodeId }),
                );
                break;
            }
            case "resize-handle":
                into[POSITION_ATTRIBUTE] = id("position");
                break;
        }
        this.features.attributes(part, payload, into);
        return Object.freeze(into);
    }

    private createAdapter(): FlowEngineAdapter {
        return {
            model: this.model,
            settings: Object.freeze({
                onlyRenderVisible: this.options.onlyRenderVisible ?? false,
            }),
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
            registerEdge: (edgeId, element) => {
                if (this.destroyed) return;
                if (element) this.edges.set(edgeId, element);
                else this.edges.delete(edgeId);
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
        };
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
