import {
    ApplicationRef,
    afterNextRender,
    computed,
    Directive,
    ErrorHandler,
    effect,
    inject,
    input,
    type OnInit,
    type OutputEmitterRef,
    output,
    type Signal,
    signal,
    untracked,
} from "@angular/core";
import {
    type AnyTypes,
    type AutoPanOptions,
    type CommandEvent,
    type CreateId,
    createFlowEngine,
    createFlowModel,
    type DefaultEdgeOptions,
    ENGINE_EVENT_CALLBACKS,
    type FitViewPayload,
    type FlowEdge,
    type FlowEdgeInput,
    type FlowEngine,
    type FlowEngineEvent,
    type FlowEngineEventOf,
    type FlowEngineOptions,
    type FlowFeatures,
    type FlowModel,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
    partAttributes,
    type Viewport,
} from "@fragiola/flow";
import {
    type AnyFlowEngine,
    type AnyFlowModel,
    eraseModel,
    FLOW_CONTEXT,
    type FlowContext,
    typedEngine,
} from "../context";
import { type FlowRef, setFlowRef } from "../inject/create-flow-ref";
import { flowValue } from "../inject/internal";
import { createEngineFacade } from "../utils/engine-facade";
import {
    bindAttributes,
    bindStructuralStyle,
    injectHost,
    onDestroy,
    optionalBoolean,
    optionalNumber,
} from "../utils/helpers";

export interface RootState {
    /** the gestures and keys may change the flow (`set-interactive`, `data-interactive`) */
    interactive: boolean;
    /** the viewport is being panned (`data-panning`) */
    panning: boolean;
    /** nodes are being dragged (`drag()`, `data-dragging`) */
    dragging: boolean;
    /** a connection is being drawn (`connection()`, `data-connecting`) */
    connecting: boolean;
    /** a box selection is being drawn (`selection()`, `data-selecting`) */
    selecting: boolean;
}

/** The engine's options a root takes as inputs: each one that changes applies at once. */
export type RootEngineProps = Pick<
    FlowEngineOptions,
    | "minZoom"
    | "maxZoom"
    | "translateExtent"
    | "panOnDrag"
    | "panOnScroll"
    | "zoomOnScroll"
    | "zoomOnPinch"
    | "zoomOnDoubleClick"
    | "zoomStep"
    | "interactive"
    | "onlyRenderVisible"
    | "pathOptions"
    | "autoPan"
    | "panActivationKey"
    | "panOnScrollMode"
    | "panOnScrollSpeed"
    | "zoomActivationKey"
    | "easing"
    | "nodeOrigin"
    | "nodeExtent"
    | "elevateNodesOnSelect"
    | "elevateEdgesOnSelect"
    | "paneClickDistance"
    | "nodeClickDistance"
    | "preventScrolling"
    | "nodesFocusable"
    | "edgesFocusable"
>;

/** A viewport change, as `(viewportMove)` tells it (React's `onViewportChange(viewport, gesture)`). */
export interface ViewportMoveEvent {
    readonly viewport: Viewport;
    /** a gesture moved it (a pan, the wheel, a pinch), not an action */
    readonly gesture: boolean;
}

/** `NodeClick` → `nodeClick`: an engine event's output, from the core's callback name. */
function outputName(name: string): string {
    return name.charAt(0).toLowerCase() + name.slice(1);
}

/** The `meta` of the commands that bring the model to the controlled inputs. */
const CONTROLLED_META = Object.freeze({ source: "controlled" });

/** The error of a model read before the root's inputs are set: Angular's NG0950, as an input's. */
function notInitialized(): Error {
    return Object.assign(
        new Error(
            "[flowRoot]: its model is read before its inputs are set (read it from ngOnInit on, or in a template, a computed or an effect)",
        ),
        { code: -950 },
    );
}

const DEFAULT_VIEWPORT: Viewport = Object.freeze({ x: 0, y: 0, zoom: 1 });

/** A list of features by their names, in order: an equal new list (`[features]="[drag()]"`) is the same. */
function featureNames(features: FlowFeatures | undefined): string {
    return (features ?? []).map((feature) => feature.name).join(",");
}

/**
 * Each engine option's value as a key: a new equal object (`pathOptions`) is the same, a function
 * (`easing`) is itself, and `null` (`[panActivationKey]="null"`: none) is not `undefined` (the
 * default).
 */
function optionKeys(options: RootEngineProps): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(options).map(([key, value]) => [
            key,
            typeof value === "function" || value === undefined
                ? value
                : JSON.stringify(value),
        ]),
    );
}

/** `panOnDrag`'s input: a bare attribute is `true`, mouse buttons (`[panOnDrag]="[1, 2]"`) stay a list. */
function panOnDragInput(
    value: boolean | readonly number[] | "" | null | undefined,
): boolean | readonly number[] | undefined {
    return Array.isArray(value) ? value : optionalBoolean(value);
}

/** `autoPan`'s input: a bare attribute is `true`, its options (`{ speed, margin }`) stay an object. */
function autoPanInput(
    value: boolean | AutoPanOptions | "" | null | undefined,
): boolean | AutoPanOptions | undefined {
    return value !== null && typeof value === "object"
        ? value
        : optionalBoolean(value);
}

/** `fitView`'s input: a bare attribute is `true`, a payload stays one. */
function fitViewInput(
    value: boolean | FitViewPayload | "" | null | undefined,
): boolean | FitViewPayload | undefined {
    if (value === "") return true;
    return value ?? undefined;
}

/**
 * The flow (`data-flow-part="root"`), on the element the flow renders in:
 * `<div flowRoot [features]="features" [defaultNodes]="nodes">`. It owns the model (unless given
 * one) and the engine, attaches the engine to its element (the engine listens to it: pointer,
 * wheel, keys, focus) and provides the flow to the parts inside. Give it a size (the flow fills
 * it). `#flow="flowRoot"` gives the rest of the template its `model()`, its `engine` and its
 * `state()`.
 *
 * The engine is created once the root is rendered in a browser (`afterNextRender`), one per model
 * (another `model` destroys it and creates one at the last viewport), and destroyed with the root.
 */
@Directive({
    selector: "[flowRoot]",
    exportAs: "flowRoot",
    providers: [
        {
            provide: FLOW_CONTEXT,
            useFactory: (): FlowContext => inject(FlowRootDirective).context,
        },
    ],
})
export class FlowRootDirective<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
> implements OnInit
{
    /**
     * the flow model. Its middleware (`model.use`) sees every command the flow runs, and its
     * listeners (`model.subscribe`) every change. Give it, or let the root create one from
     * `nodes` / `defaultNodes` and `edges` / `defaultEdges`. Another model gets another engine
     */
    readonly modelInput = input<FlowModel<T, F> | undefined>(undefined, {
        alias: "model",
    });
    /** the nodes of the model the root creates (read once, when it creates it) */
    readonly defaultNodes = input<readonly FlowNodeInput<T>[] | undefined>(
        undefined,
    );
    /** the edges of the model the root creates (read once, when it creates it) */
    readonly defaultEdges = input<readonly FlowEdgeInput<T>[] | undefined>(
        undefined,
    );
    /**
     * controlled nodes (`[(nodes)]`): each new list brings the model to it with the commands a
     * user would run (`model.get("commands-to")`, one `batch`); every change of the model's nodes
     * emits `nodesChange`. Give every node its id
     */
    readonly nodes = input<readonly FlowNode<T>[] | undefined>(undefined);
    /** controlled edges (`[(edges)]`), as `nodes` */
    readonly edges = input<readonly FlowEdge<T>[] | undefined>(undefined);
    /**
     * the opt-in features of the model the root creates (read once, when it creates it):
     * `[selection(), drag(), connection()]`, each from its entry (`@fragiola/flow-angular/drag`).
     * A `model` has its own
     */
    readonly features = input<F | undefined>(undefined);
    /** the id generator of the model the root creates (read once, when it creates it) */
    readonly createId = input<CreateId | undefined>(undefined);
    /**
     * the fields every `edge.add` of the model the root creates fills in where it leaves them out
     * (read once, when it creates it: the model option `defaultEdgeOptions`)
     */
    readonly defaultEdgeOptions = input<DefaultEdgeOptions<T> | undefined>(
        undefined,
    );
    /** controlled viewport (`[(viewport)]`): a new value is set on the engine (`set-viewport`) */
    readonly viewport = input<Viewport | undefined>(undefined);
    /** the viewport the flow starts at (read once); default `{ x: 0, y: 0, zoom: 1 }` */
    readonly defaultViewport = input<Viewport | undefined>(undefined);
    /** fits the nodes once they are all measured (read once): a bare `fitView`, or a payload */
    readonly fitView = input(undefined, { transform: fitViewInput });
    /** access to the model and the engine from outside the root (`createFlowRef`) */
    readonly flowRef = input<FlowRef<T, F> | undefined>(undefined);
    /** the engine's options (React's root props): each one that changes applies at once */
    readonly minZoom = input(undefined, { transform: optionalNumber });
    readonly maxZoom = input(undefined, { transform: optionalNumber });
    readonly translateExtent = input<
        FlowEngineOptions["translateExtent"] | undefined
    >(undefined);
    readonly panOnDrag = input(undefined, { transform: panOnDragInput });
    readonly panOnScroll = input(undefined, { transform: optionalBoolean });
    readonly zoomOnScroll = input(undefined, { transform: optionalBoolean });
    readonly zoomOnPinch = input(undefined, { transform: optionalBoolean });
    readonly zoomOnDoubleClick = input(undefined, {
        transform: optionalBoolean,
    });
    readonly zoomStep = input(undefined, { transform: optionalNumber });
    readonly interactive = input(undefined, { transform: optionalBoolean });
    readonly onlyRenderVisible = input(undefined, {
        transform: optionalBoolean,
    });
    readonly pathOptions = input<FlowEngineOptions["pathOptions"] | undefined>(
        undefined,
    );
    readonly autoPan = input(undefined, { transform: autoPanInput });
    readonly panActivationKey = input<
        FlowEngineOptions["panActivationKey"] | undefined
    >(undefined);
    readonly panOnScrollMode = input<
        FlowEngineOptions["panOnScrollMode"] | undefined
    >(undefined);
    readonly panOnScrollSpeed = input(undefined, {
        transform: optionalNumber,
    });
    readonly zoomActivationKey = input<
        FlowEngineOptions["zoomActivationKey"] | undefined
    >(undefined);
    readonly easing = input<FlowEngineOptions["easing"] | undefined>(undefined);
    readonly nodeOrigin = input<FlowEngineOptions["nodeOrigin"] | undefined>(
        undefined,
    );
    readonly nodeExtent = input<FlowEngineOptions["nodeExtent"] | undefined>(
        undefined,
    );
    readonly elevateNodesOnSelect = input(undefined, {
        transform: optionalBoolean,
    });
    readonly elevateEdgesOnSelect = input(undefined, {
        transform: optionalBoolean,
    });
    readonly paneClickDistance = input(undefined, {
        transform: optionalNumber,
    });
    readonly nodeClickDistance = input(undefined, {
        transform: optionalNumber,
    });
    readonly preventScrolling = input(undefined, {
        transform: optionalBoolean,
    });
    readonly nodesFocusable = input(undefined, { transform: optionalBoolean });
    readonly edgesFocusable = input(undefined, { transform: optionalBoolean });

    /** the model's nodes after every command that changes them (a drag step too), but the controlled ones' */
    readonly nodesChange = output<readonly FlowNode<T>[]>();
    /** the model's edges after every command that changes them, but the controlled ones' */
    readonly edgesChange = output<readonly FlowEdge<T>[]>();
    /** the viewport after every change, by a gesture or an action (`[(viewport)]`) */
    readonly viewportChange = output<Viewport>();
    /** every viewport change with what made it (`gesture: true` for a pan, the wheel, a pinch) */
    readonly viewportMove = output<ViewportMoveEvent>();

    // One output per engine event, named from the core's table (`ENGINE_EVENT_CALLBACKS`: React's
    // `onNodeClick` is `(nodeClick)`), each emitted with the event. Angular needs them declared;
    // `tests/interaction.test.ts` keeps this list equal to the table.
    // (the viewport events' types written out: inferred, they would name the core's unexported
    // `ViewportMove` in the bundled declarations)
    readonly moveStart: OutputEmitterRef<
        FlowEngineEventOf<"viewport-change-start">
    > = output();
    readonly moveEnd: OutputEmitterRef<
        FlowEngineEventOf<"viewport-change-end">
    > = output();
    readonly init = output<FlowEngineEventOf<"ready">>();
    readonly nodeClick = output<FlowEngineEventOf<"node-click">>();
    readonly nodeDoubleClick = output<FlowEngineEventOf<"node-double-click">>();
    readonly nodeContextMenu = output<FlowEngineEventOf<"node-context-menu">>();
    readonly edgeClick = output<FlowEngineEventOf<"edge-click">>();
    readonly edgeDoubleClick = output<FlowEngineEventOf<"edge-double-click">>();
    readonly edgeContextMenu = output<FlowEngineEventOf<"edge-context-menu">>();
    readonly paneClick = output<FlowEngineEventOf<"pane-click">>();
    readonly paneDoubleClick = output<FlowEngineEventOf<"pane-double-click">>();
    readonly paneContextMenu = output<FlowEngineEventOf<"pane-context-menu">>();
    readonly selectionContextMenu =
        output<FlowEngineEventOf<"selection-context-menu">>();
    readonly selectionStart = output<FlowEngineEventOf<"box-select-start">>();
    readonly selectionEnd = output<FlowEngineEventOf<"box-select">>();
    readonly nodeDragStart = output<FlowEngineEventOf<"drag-start">>();
    readonly nodesMove = output<FlowEngineEventOf<"nodes-move">>();
    readonly nodeDragCancel = output<FlowEngineEventOf<"drag-cancel">>();
    readonly connectStart = output<FlowEngineEventOf<"connect-start">>();
    readonly connectTarget = output<FlowEngineEventOf<"connect-target">>();
    readonly connect = output<FlowEngineEventOf<"connect">>();
    readonly connectCancel = output<FlowEngineEventOf<"connect-cancel">>();
    readonly reconnectStart = output<FlowEngineEventOf<"reconnect-start">>();
    readonly reconnect = output<FlowEngineEventOf<"reconnect">>();
    readonly reconnectCancel = output<FlowEngineEventOf<"reconnect-cancel">>();
    readonly resizeStart = output<FlowEngineEventOf<"resize-start">>();
    readonly resizeEnd = output<FlowEngineEventOf<"resize">>();
    readonly resizeCancel = output<FlowEngineEventOf<"resize-cancel">>();
    readonly delete = output<FlowEngineEventOf<"remove">>();

    /** each engine event's output, by the event's type */
    private readonly eventOutputs: ReadonlyMap<
        string,
        OutputEmitterRef<FlowEngineEvent>
    > = new Map(
        Object.entries(ENGINE_EVENT_CALLBACKS).map(([type, name]) => [
            type,
            (
                this as unknown as Record<
                    string,
                    OutputEmitterRef<FlowEngineEvent>
                >
            )[outputName(name)] as OutputEmitterRef<FlowEngineEvent>,
        ]),
    );

    private readonly host = injectHost();
    /** its inputs are set (`ngOnInit`) */
    private readonly initialized = signal(false);
    /** the model the root created, once it needs one */
    private own: FlowModel<T, F> | undefined;
    /** the names of the features the root's own model was created with */
    private createdWith: string | undefined;

    /** the root's model: its `model` input, or the one it created from its inputs */
    readonly model: Signal<FlowModel<T, F>> = computed(() => {
        // before its inputs are set (a child's constructor, a binding read early), the model is
        // not known yet: Angular's error for an input read too early (NG0950, which the parts'
        // early reads expect), rather than a model made from inputs not given yet
        if (!this.initialized()) throw notInitialized();
        const given = this.modelInput();
        if (given) return given;
        this.own ??= untracked(() => {
            const features = this.features();
            this.createdWith = featureNames(features);
            return createFlowModel<T, F>(
                {
                    version: 1,
                    nodes: [...(this.nodes() ?? this.defaultNodes() ?? [])],
                    edges: [...(this.edges() ?? this.defaultEdges() ?? [])],
                } as never,
                {
                    features,
                    createId: this.createId(),
                    defaultEdgeOptions: this.defaultEdgeOptions(),
                },
            );
        });
        return this.own;
    });
    private readonly erased = computed(() => eraseModel(this.model()));

    /** the viewport a new engine starts at: the last one's (another model), else the inputs' */
    private start: Viewport | undefined;
    private readonly facade = createEngineFacade(
        () =>
            this.start ??
            this.viewport() ??
            this.defaultViewport() ??
            DEFAULT_VIEWPORT,
    );
    /**
     * the engine of the flow on screen, as apps see it: screen actions (`engine.run("fit-view")`),
     * screen facts (`engine.get("viewport")`) and its events (`engine.subscribe`). It is there
     * from the start; before the root created its engine an action is refused and a read is empty
     */
    readonly engine: FlowEngine<T, F> = typedEngine<T, F>(this.facade.engine);

    private readonly current = signal<AnyFlowEngine | null>(null);
    private readonly revision = signal(0);
    private readonly bump = () => {
        this.revision.update((value) => value + 1);
        this.renderSoon();
    };
    private readonly application = inject(ApplicationRef);
    private readonly errorHandler = inject(ErrorHandler);
    private renderQueued = false;

    /**
     * Renders a change of the flow before the next task (a microtask), as Vue and Svelte flush
     * theirs: zoneless Angular would render it in a later task (a timeout or a frame), so a key
     * press or a click that moved a node or reached a zoom limit would still show the old view to
     * whatever reads the page right after it (an assistive technology, a test). One render per
     * root and task, however many commits and view changes it had; none once the application is
     * destroyed. An error of that render goes to the app's `ErrorHandler`, as one of Angular's
     * own scheduled renders does (thrown from a microtask, it would reach no handler).
     */
    private renderSoon(): void {
        if (this.renderQueued) return;
        this.renderQueued = true;
        queueMicrotask(() => {
            this.renderQueued = false;
            if (this.application.destroyed) return;
            try {
                this.application.tick();
            } catch (error) {
                this.errorHandler.handleError(error);
            }
        });
    }

    /** @internal what the parts inject */
    readonly context: FlowContext = {
        model: this.erased,
        engine: this.current.asReadonly(),
        publicEngine: this.facade.engine as unknown as AnyFlowEngine,
        rootElement: this.host,
        revision: this.revision.asReadonly(),
    };

    private readonly attributes = flowValue(this.context, () => {
        const live = this.current();
        return live ? live.adapter.attributes("root") : partAttributes("root");
    });

    /** what the root shows as `data-*` (`#flow="flowRoot"`, then `flow.state().connecting`) */
    readonly state: Signal<RootState> = computed(() => {
        const attributes = this.attributes();
        return {
            interactive: this.current()
                ? attributes["data-interactive"] !== undefined
                : true,
            panning: attributes["data-panning"] !== undefined,
            dragging: attributes["data-dragging"] !== undefined,
            connecting: attributes["data-connecting"] !== undefined,
            selecting: attributes["data-selecting"] !== undefined,
        };
    });

    /** the engine's options as the inputs give them */
    private readonly engineProps = computed(
        (): RootEngineProps => ({
            minZoom: this.minZoom(),
            maxZoom: this.maxZoom(),
            translateExtent: this.translateExtent(),
            panOnDrag: this.panOnDrag(),
            panOnScroll: this.panOnScroll(),
            zoomOnScroll: this.zoomOnScroll(),
            zoomOnPinch: this.zoomOnPinch(),
            zoomOnDoubleClick: this.zoomOnDoubleClick(),
            zoomStep: this.zoomStep(),
            interactive: this.interactive(),
            onlyRenderVisible: this.onlyRenderVisible(),
            pathOptions: this.pathOptions(),
            autoPan: this.autoPan(),
            panActivationKey: this.panActivationKey(),
            panOnScrollMode: this.panOnScrollMode(),
            panOnScrollSpeed: this.panOnScrollSpeed(),
            zoomActivationKey: this.zoomActivationKey(),
            easing: this.easing(),
            nodeOrigin: this.nodeOrigin(),
            nodeExtent: this.nodeExtent(),
            elevateNodesOnSelect: this.elevateNodesOnSelect(),
            elevateEdgesOnSelect: this.elevateEdgesOnSelect(),
            paneClickDistance: this.paneClickDistance(),
            nodeClickDistance: this.nodeClickDistance(),
            preventScrolling: this.preventScrolling(),
            nodesFocusable: this.nodesFocusable(),
            edgesFocusable: this.edgesFocusable(),
        }),
    );

    /** the controlled lists the model was last brought to (a model the root created starts at them) */
    private sent: { model: unknown; nodes: unknown; edges: unknown } = {
        model: undefined,
        nodes: undefined,
        edges: undefined,
    };

    constructor() {
        bindStructuralStyle(this.host, () => ({
            position: "relative",
            overflow: "hidden",
        }));
        bindAttributes(this.host, this.attributes);

        // misuse the root ignores, once each
        const warned = new Set<string>();
        const warn = (message: string) => {
            if (warned.has(message)) return;
            warned.add(message);
            console.warn(`[@fragiola/flow-angular] ${message}`);
        };
        // the features are the model's, fixed when it is created: a later change is ignored
        effect(() => {
            const names = featureNames(this.features());
            this.model();
            untracked(() => {
                if (
                    !this.modelInput() &&
                    this.createdWith !== undefined &&
                    names !== this.createdWith
                ) {
                    warn(
                        "the features input changed after the root created its model: the change is ignored (the features are fixed when the model is created)",
                    );
                }
            });
        });

        // the model's commits: every part reads them through `revision`; the app hears them
        // through the outputs, but the controlled inputs' own commands
        effect((onCleanup) => {
            const model = this.erased();
            onCleanup(
                model.subscribe((event: CommandEvent) => {
                    this.bump();
                    if (event.meta?.source === CONTROLLED_META.source) return;
                    if (event.before.nodes !== event.after.nodes) {
                        this.nodesChange.emit(
                            event.after.nodes as readonly FlowNode<T>[],
                        );
                    }
                    if (event.before.edges !== event.after.edges) {
                        this.edgesChange.emit(
                            event.after.edges as readonly FlowEdge<T>[],
                        );
                    }
                }),
            );
            // a commit between the first read and the subscription is read again
            untracked(this.bump);
        });

        // the controlled lists, on every new list (a model the app gives starts at them)
        effect(() => {
            const model = this.erased();
            const nodes = this.nodes();
            const edges = this.edges();
            untracked(() => this.syncControlled(model, nodes, edges, warn));
        });

        // the engine options last sent, by key: a change sends only the keys that changed (an
        // `interactive` that stays must not undo the lock of `[flowToggleInteractive]`)
        let sentOptions: Record<string, unknown> = {};
        // the engine, once rendered in a browser (a server render never attaches nor observes
        // anything), one per model
        const rendered = signal(false);
        afterNextRender(() => rendered.set(true));
        effect((onCleanup) => {
            if (!rendered()) return;
            const model = this.erased();
            untracked(() => {
                const options = this.engineProps();
                const created = createFlowEngine(model, {
                    ...options,
                    defaultViewport: {
                        ...(this.start ??
                            this.viewport() ??
                            this.defaultViewport() ??
                            DEFAULT_VIEWPORT),
                    },
                    fitView: this.fitView(),
                }) as unknown as AnyFlowEngine;
                sentOptions = optionKeys(options);
                const stops = [
                    created.adapter.subscribe(this.bump),
                    created.subscribe((event) => {
                        if (event.type !== "viewport-change") {
                            // the event's output (`nodeClick`, `moveStart`, …)
                            this.eventOutputs.get(event.type)?.emit(event);
                            return;
                        }
                        this.start = event.viewport;
                        this.viewportChange.emit(event.viewport);
                        this.viewportMove.emit({
                            viewport: event.viewport,
                            gesture: event.gesture,
                        });
                    }),
                ];
                this.facade.set(created as unknown as FlowEngine);
                created.adapter.attachRoot(this.host);
                this.current.set(created);
                onCleanup(() => {
                    for (const stop of stops) stop();
                    this.start = created.get("viewport");
                    this.current.set(null);
                    this.facade.set(null);
                    created.adapter.detachRoot();
                    created.destroy();
                });
            });
        });

        // the engine options that changed since they were sent
        effect(() => {
            const live = this.current();
            const options = this.engineProps();
            if (!live) return;
            untracked(() => {
                const next = optionKeys(options);
                const changed = Object.keys(next).filter(
                    (key) => next[key] !== sentOptions[key],
                );
                sentOptions = next;
                if (changed.length === 0) return;
                const values = options as Record<string, unknown>;
                live.adapter.setOptions(
                    Object.fromEntries(
                        changed.map((key) => [key, values[key]]),
                    ),
                );
            });
        });

        // a controlled viewport that differs from the engine's is set on it
        effect(() => {
            const live = this.current();
            const viewport = this.viewport();
            if (!live || !viewport) return;
            const { x, y, zoom } = viewport;
            untracked(() => {
                const current = live.get("viewport");
                if (
                    current.x !== x ||
                    current.y !== y ||
                    current.zoom !== zoom
                ) {
                    live.run("set-viewport", { x, y, zoom });
                }
            });
        });

        // the flow ref: the model and the facade (the same object across engines)
        effect((onCleanup) => {
            const ref = this.flowRef() as unknown as
                | FlowRef<FlowTypes, FlowFeatures>
                | undefined;
            const model = this.model();
            if (!ref) return;
            untracked(() =>
                setFlowRef(ref, {
                    model: model as unknown as FlowModel<
                        FlowTypes,
                        FlowFeatures
                    >,
                    engine: this.facade.engine as unknown as FlowEngine<
                        FlowTypes,
                        FlowFeatures
                    >,
                }),
            );
            onCleanup(() => setFlowRef(ref, null));
        });

        onDestroy(() => this.facade.set(null));
    }

    ngOnInit(): void {
        this.initialized.set(true);
    }

    /**
     * Brings the model to the controlled lists that changed (packages/react's algorithm): one
     * `batch` with `meta: { source: "controlled" }`, step by step after a veto, and the model's
     * lists emitted when they differ from the inputs (a veto, a rule that kept a node in its
     * parent, a middleware that rewrote a payload): the app's state follows the model.
     */
    private syncControlled(
        model: AnyFlowModel,
        nodes: readonly FlowNode<T>[] | undefined,
        edges: readonly FlowEdge<T>[] | undefined,
        warn: (message: string) => void,
    ): void {
        const previous = this.sent;
        const sameModel = previous.model === model;
        // a model the root created starts at the lists it was created from
        const created =
            !sameModel && this.own !== undefined && !this.modelInput();
        // only a list that changed is diffed (an edge list that stays is not walked on each step),
        // and the model's own list given back (`[(nodes)]` after a drag step) needs nothing
        const target = {
            nodes: (created ||
            (sameModel && previous.nodes === nodes) ||
            nodes === model.get("all-nodes")
                ? undefined
                : nodes) as readonly FlowNode[] | undefined,
            edges: (created ||
            (sameModel && previous.edges === edges) ||
            edges === model.get("all-edges")
                ? undefined
                : edges) as readonly FlowEdge[] | undefined,
        };
        this.sent = { model, nodes, edges };
        if (target.nodes === undefined && target.edges === undefined) return;
        const commands = model.get("commands-to", target);
        if (commands.length === 0) return;
        const options = { meta: CONTROLLED_META };
        if (!model.run("batch", { commands: [...commands] }, options).ok) {
            // refused as a whole (a middleware's veto): each change that may be made is, and the
            // app hears what the model holds instead
            const refused: string[] = [];
            for (const entry of commands) {
                const result = model.run(
                    "batch",
                    { commands: [entry] },
                    options,
                );
                if (!result.ok) {
                    refused.push(`${entry.command}: ${result.error.message}`);
                }
            }
            warn(
                `the controlled nodes / edges were not all applied (the model's are reported back):\n${refused.join("\n")}`,
            );
        }
        if (
            target.nodes !== undefined &&
            model.get("commands-to", { nodes: target.nodes }).length > 0
        ) {
            const held = model.get("all-nodes") as readonly FlowNode<T>[];
            this.sent = { ...this.sent, nodes: held };
            this.nodesChange.emit(held);
        }
        if (
            target.edges !== undefined &&
            model.get("commands-to", { edges: target.edges }).length > 0
        ) {
            const held = model.get("all-edges") as readonly FlowEdge<T>[];
            this.sent = { ...this.sent, edges: held };
            this.edgesChange.emit(held);
        }
    }
}
