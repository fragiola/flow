import {
    type AnyTypes,
    type CommandEvent,
    type CreateId,
    createFlowEngine,
    createFlowModel,
    type FitViewPayload,
    type FlowEdge,
    type FlowEdgeInput,
    type FlowEngine,
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
    defineComponent,
    h,
    onBeforeUnmount,
    onMounted,
    onScopeDispose,
    onUnmounted,
    type PropType,
    provide,
    shallowRef,
    toRaw,
    watch,
} from "vue";
import {
    type FlowRef,
    type FlowRefValue,
    setFlowRef,
} from "../composables/create-flow-ref";
import { useFlowValue } from "../composables/internal";
import {
    type AnyFlowEngine,
    eraseModel,
    type FlowContextValue,
    FlowKey,
} from "../context";
import { createEngineFacade } from "../utils/engine-facade";
import {
    definePrimitive,
    type FlowComponent,
    NUMBER_PROP,
    numberProp,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import {
    elementRef,
    onClient,
    type RenderSlot,
    renderElement,
} from "../utils/render";

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

/** The engine's options a root takes as props: each one that changes applies at once. */
export type RootEngineProps = Omit<
    Pick<
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
    >,
    "panOnScrollSpeed"
> & {
    /** the factor of the wheel's pixels when it pans; the attribute's text is its number */
    panOnScrollSpeed?: number | `${number}` | undefined;
};

export interface RootProps<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
> extends PrimitiveProps,
        RootEngineProps {
    /**
     * the flow model. Its middleware (`model.use`) sees every command the flow runs, and its
     * listeners (`model.subscribe`) every change. Give it, or let the root create one from
     * `nodes` / `defaultNodes` and `edges` / `defaultEdges`. Another model remounts the flow
     */
    model?: FlowModel<T, F> | undefined;
    /** the nodes of the model the root creates (read once, at mount) */
    defaultNodes?: readonly FlowNodeInput<T>[] | undefined;
    /** the edges of the model the root creates (read once, at mount) */
    defaultEdges?: readonly FlowEdgeInput<T>[] | undefined;
    /**
     * controlled nodes (`v-model:nodes`): a new list brings the model to it with the commands a
     * user would run (`model.get("commands-to")`, one `batch`); every change of the model's nodes
     * emits `update:nodes`. Give every node its id
     */
    nodes?: readonly FlowNode<T>[] | undefined;
    /** controlled edges (`v-model:edges`), as `nodes` */
    edges?: readonly FlowEdge<T>[] | undefined;
    /**
     * the opt-in features of the model the root creates (read once, at mount):
     * `[selection(), drag(), connection()]`, each from its entry (`@fragiola/flow-vue/drag`). A
     * `model` has its own
     */
    features?: F | undefined;
    /** the id generator of the model the root creates (read once, at mount) */
    createId?: CreateId | undefined;
    /** controlled viewport (`v-model:viewport`): a new value is set on the engine (`set-viewport`) */
    viewport?: Viewport | undefined;
    /** the viewport the flow starts at (read once, at mount); default `{ x: 0, y: 0, zoom: 1 }` */
    defaultViewport?: Viewport | undefined;
    /** fits the nodes once they are all measured (read once, at mount) */
    fitView?: boolean | FitViewPayload | undefined;
    /** access to the model and the engine from outside the root (`useFlowRef`, `createFlowRef`) */
    flowRef?: FlowRef<T, F> | undefined;
}

export interface RootSlots extends RenderSlot<RootState> {
    /** the flow: `Flow.Background`, `Flow.Viewport`, `Flow.Controls`, `MiniMap`, … */
    default?: SlotFunction<{ state: RootState }>;
}

/** The events of `Flow.Root`: the controlled values, for `v-model` (or `@update:…`). */
export type RootEmits<T extends FlowTypes = AnyTypes> = {
    /** the model's nodes, after every command that changes them (a drag step too) */
    "update:nodes": (nodes: readonly FlowNode<T>[]) => void;
    /** the model's edges, after every command that changes them */
    "update:edges": (edges: readonly FlowEdge<T>[]) => void;
    /** every viewport change, by a gesture (`gesture: true`) or an action */
    "update:viewport": (viewport: Viewport, gesture: boolean) => void;
};

const ENGINE_PROPS = [
    "minZoom",
    "maxZoom",
    "translateExtent",
    "panOnDrag",
    "panOnScroll",
    "zoomOnScroll",
    "zoomOnPinch",
    "zoomOnDoubleClick",
    "zoomStep",
    "interactive",
    "onlyRenderVisible",
    "pathOptions",
    "autoPan",
    "panActivationKey",
    "panOnScrollMode",
    "panOnScrollSpeed",
    "zoomActivationKey",
    "easing",
    "nodeOrigin",
    "nodeExtent",
    "elevateNodesOnSelect",
    "elevateEdgesOnSelect",
] as const satisfies readonly (keyof RootEngineProps)[];

const ROOT_PROPS = [
    "model",
    "defaultNodes",
    "defaultEdges",
    "nodes",
    "edges",
    "features",
    "createId",
    "viewport",
    "defaultViewport",
    "fitView",
    "flowRef",
    ...ENGINE_PROPS,
    "as",
] as const satisfies readonly (keyof RootProps)[];

/** The props a bare attribute turns on (`<Flow.Root pan-on-scroll>`). */
const ROOT_BOOLEANS = [
    "panOnDrag",
    "panOnScroll",
    "zoomOnScroll",
    "zoomOnPinch",
    "zoomOnDoubleClick",
    "interactive",
    "onlyRenderVisible",
    "autoPan",
    "elevateNodesOnSelect",
    "elevateEdgesOnSelect",
] as const satisfies readonly (keyof RootProps)[];

const ROOT_EMITS = [
    "update:nodes",
    "update:edges",
    "update:viewport",
] as const satisfies readonly (keyof RootEmits)[];

/** The root's props as its implementation reads them: any registry, any features. */
type AnyRootProps = RootProps<AnyTypes, FlowFeatures>;

/** The `meta` of the commands that bring the model to the controlled props. */
const CONTROLLED_META = Object.freeze({ source: "controlled" });

const DEFAULT_VIEWPORT: Viewport = Object.freeze({ x: 0, y: 0, zoom: 1 });

const ROOT_STYLE = { position: "relative", overflow: "hidden" };

/** A list of features by their names, in order: an equal new list is the same. */
function featureNames(features: FlowFeatures | undefined): string {
    return (features ?? []).map((feature) => feature.name).join(",");
}

/** Warns once per message and root: misuse that the root ignores. */
function warnOnce(): (message: string) => void {
    const warned = new Set<string>();
    return (message) => {
        if (warned.has(message)) return;
        warned.add(message);
        console.warn(`[@fragiola/flow-vue] ${message}`);
    };
}

/**
 * Each engine option's value as a key: a new equal object (`pathOptions`) is the same, a function
 * (`easing`) is itself, and `null` (`:pan-activation-key="null"`: none) is not `undefined` (the
 * default).
 */
function optionKeys(
    options: Partial<FlowEngineOptions>,
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(options).map(([key, value]) => [
            key,
            typeof value === "function" || value === undefined
                ? value
                : JSON.stringify(value),
        ]),
    );
}

/** A key that changes when an engine option's value does (but a function's: `easing` is watched). */
function optionsKey(options: Partial<FlowEngineOptions>): string {
    return JSON.stringify(optionKeys(options), (_key, value) =>
        value === undefined ? "undefined" : value,
    );
}

/**
 * A list the app owns, as the model takes it: the plain list, never a reactive proxy (a frozen
 * list, the model's own given back by `update:nodes`, is taken as it is).
 */
function plainList<E extends object>(
    list: readonly E[] | undefined,
): readonly E[] | undefined {
    if (list === undefined) return undefined;
    const raw = toRaw(list);
    return Object.isFrozen(raw) ? raw : raw.map((entry) => toRaw(entry));
}

/** A value the app owns, without its reactive proxy. */
function plain<V>(value: V): V {
    return value !== null && typeof value === "object" ? toRaw(value) : value;
}

/** a key per object: another model remounts the flow (`-1` for none) */
const modelKeys = new WeakMap<object, number>();
let nextModelKey = 0;
function keyOfModel(model: object | undefined): number {
    if (model === undefined) return -1;
    const raw = toRaw(model);
    let key = modelKeys.get(raw);
    if (key === undefined) {
        key = nextModelKey++;
        modelKeys.set(raw, key);
    }
    return key;
}

/** The flow of one model: it owns the engine, so it lives as long as the model does. */
const RootFlow = definePrimitive<AnyRootProps, RootSlots, RootEmits<AnyTypes>>(
    "RootFlow",
    ROOT_PROPS,
    (props, { attrs, slots, emit }) => {
        const given = props.model ? toRaw(props.model) : undefined;
        const ownModel = given
            ? null
            : createFlowModel<AnyTypes, FlowFeatures>(
                  {
                      version: 1,
                      nodes: [
                          ...(plainList(props.nodes ?? props.defaultNodes) ??
                              []),
                      ],
                      edges: [
                          ...(plainList(props.edges ?? props.defaultEdges) ??
                              []),
                      ],
                  } as never,
                  {
                      features: plain(props.features),
                      createId: props.createId,
                  },
              );
        const typed = (given ?? ownModel) as FlowModel<AnyTypes, FlowFeatures>;
        const model = eraseModel(typed);

        // the features are the model's, fixed when it is created: a later change is ignored
        const warn = warnOnce();
        const firstFeatures = featureNames(props.features);
        watch(
            () => featureNames(props.features),
            (next) => {
                if (!props.model && next !== firstFeatures) {
                    warn(
                        "the features prop changed after the root created its model: the change is ignored (the features are fixed when the model is created)",
                    );
                }
            },
        );

        const engineProps = (): Partial<FlowEngineOptions> =>
            Object.fromEntries(
                ENGINE_PROPS.map((name) => [
                    name,
                    name === "panOnScrollSpeed"
                        ? numberProp(props[name])
                        : plain(props[name]),
                ]),
            ) as Partial<FlowEngineOptions>;
        const start = plain(
            props.viewport ?? props.defaultViewport ?? DEFAULT_VIEWPORT,
        );
        const facade = createEngineFacade(start);
        const engine = shallowRef<AnyFlowEngine | null>(null);
        const revision = shallowRef(0);
        const rootElement = shallowRef<HTMLElement | null>(null);
        const bump = () => {
            revision.value++;
        };

        // the engine options last sent, by key: a change sends only the keys that changed (an
        // `interactive` that stays must not undo the lock of `Flow.ToggleInteractive`)
        let sentOptions: Record<string, unknown> = {};
        const stops: (() => void)[] = [];
        // the engine is created once mounted, so that no server render attaches or observes
        // anything; the parts that attach to it read `engine` in their render, and patch then
        onMounted(() => {
            const options = engineProps();
            const created = createFlowEngine(model, {
                ...options,
                defaultViewport: { x: start.x, y: start.y, zoom: start.zoom },
                fitView: plain(props.fitView),
            }) as unknown as AnyFlowEngine;
            sentOptions = optionKeys(options);
            stops.push(
                created.adapter.subscribe(bump),
                created.subscribe((event) => {
                    if (event.type === "viewport-change") {
                        emit("update:viewport", event.viewport, event.gesture);
                    }
                }),
            );
            facade.set(created as unknown as FlowEngine);
            engine.value = created;
            holdFlowRef(props.flowRef);
        });
        // destroyed once its parts are gone: they let go of their elements first
        onUnmounted(() => {
            for (const stop of stops.splice(0)) stop();
            const current = engine.value;
            facade.set(null);
            engine.value = null;
            current?.destroy();
        });

        // the flow ref: the model and the facade (the same object across engines)
        const handle = {
            model: typed,
            engine: facade.engine,
        } as unknown as FlowRefValue<FlowTypes, FlowFeatures>;
        let heldRef: FlowRef<FlowTypes, FlowFeatures> | undefined;
        const holdFlowRef = (
            next: FlowRef<AnyTypes, FlowFeatures> | undefined,
        ) => {
            const ref = next
                ? (toRaw(next) as unknown as FlowRef<FlowTypes, FlowFeatures>)
                : undefined;
            if (ref === heldRef) return;
            if (heldRef) setFlowRef(heldRef, null);
            heldRef = ref;
            if (ref) setFlowRef(ref, handle);
        };
        watch(
            () => props.flowRef,
            (next) => {
                if (engine.value) holdFlowRef(next);
            },
        );
        onBeforeUnmount(() => holdFlowRef(undefined));

        // the engine options that changed since they were sent
        watch([() => optionsKey(engineProps()), () => props.easing], () => {
            const live = engine.value;
            if (!live) return;
            const options = engineProps() as Record<string, unknown>;
            const next = optionKeys(options);
            const changed = Object.keys(next).filter(
                (key) => next[key] !== sentOptions[key],
            );
            sentOptions = next;
            if (changed.length === 0) return;
            live.adapter.setOptions(
                Object.fromEntries(changed.map((key) => [key, options[key]])),
            );
        });

        // a controlled viewport that differs from the engine's is set on it
        watch(
            () => [
                engine.value,
                props.viewport?.x,
                props.viewport?.y,
                props.viewport?.zoom,
            ],
            () => {
                const live = engine.value;
                const viewport = props.viewport;
                if (!live || !viewport) return;
                const current = live.get("viewport");
                if (
                    current.x !== viewport.x ||
                    current.y !== viewport.y ||
                    current.zoom !== viewport.zoom
                ) {
                    live.run("set-viewport", {
                        x: viewport.x,
                        y: viewport.y,
                        zoom: viewport.zoom,
                    });
                }
            },
        );

        // the controlled lists the model was last brought to (a model the root created starts at
        // them)
        let sent: { nodes: unknown; edges: unknown } = ownModel
            ? { nodes: props.nodes, edges: props.edges }
            : { nodes: undefined, edges: undefined };
        const syncControlled = () => {
            const { nodes, edges } = props;
            // only a list that changed is diffed (an edge list that stays is not walked on each
            // step)
            const target = {
                nodes: (nodes === sent.nodes ? undefined : plainList(nodes)) as
                    | readonly FlowNode[]
                    | undefined,
                edges: (edges === sent.edges ? undefined : plainList(edges)) as
                    | readonly FlowEdge[]
                    | undefined,
            };
            sent = { nodes, edges };
            if (target.nodes === undefined && target.edges === undefined) {
                return;
            }
            const commands = model.get("commands-to", target);
            if (commands.length === 0) return;
            const options = { meta: CONTROLLED_META };
            if (!model.run("batch", { commands: [...commands] }, options).ok) {
                // refused as a whole (a middleware's veto): each change that may be made is, and
                // the app hears what the model holds instead
                const refused: string[] = [];
                for (const entry of commands) {
                    const result = model.run(
                        "batch",
                        { commands: [entry] },
                        options,
                    );
                    if (!result.ok) {
                        refused.push(
                            `${entry.command}: ${result.error.message}`,
                        );
                    }
                }
                warn(
                    `the controlled nodes / edges were not all applied (the model's are reported back):\n${refused.join("\n")}`,
                );
            }
            // what the model holds when it differs from the props (a veto, a rule that kept a
            // node in its parent, a middleware that rewrote a payload): the app's state follows
            // the model
            if (
                target.nodes !== undefined &&
                model.get("commands-to", { nodes: target.nodes }).length > 0
            ) {
                emit("update:nodes", model.get("all-nodes"));
            }
            if (
                target.edges !== undefined &&
                model.get("commands-to", { edges: target.edges }).length > 0
            ) {
                emit("update:edges", model.get("all-edges"));
            }
        };
        watch([() => props.nodes, () => props.edges], syncControlled);

        // on the client only: a server render neither changes a model that may be shared by other
        // requests, nor subscribes to it
        onClient(() => {
            syncControlled();
            onScopeDispose(
                model.subscribe((event: CommandEvent) => {
                    bump();
                    if (event.meta?.source === CONTROLLED_META.source) return;
                    if (event.before.nodes !== event.after.nodes) {
                        emit("update:nodes", event.after.nodes);
                    }
                    if (event.before.edges !== event.after.edges) {
                        emit("update:edges", event.after.edges);
                    }
                }),
            );
        });

        const context: FlowContextValue = {
            model,
            engine,
            publicEngine: facade.engine as unknown as AnyFlowEngine,
            rootElement,
            revision,
        };
        provide(FlowKey, context);

        const rootRef = elementRef(
            (element) => {
                rootElement.value = element as HTMLElement;
                const live = engine.value;
                if (live) live.adapter.attachRoot(element as HTMLElement);
                return () => {
                    if (live) live.adapter.detachRoot();
                    rootElement.value = null;
                };
            },
            () => [engine.value],
        );
        const attributes = useFlowValue(context, () => {
            const live = engine.value;
            return live
                ? live.adapter.attributes("root")
                : partAttributes("root");
        });

        return () => {
            const live = engine.value;
            const current = attributes.value;
            const state: RootState = {
                interactive: live
                    ? current["data-interactive"] !== undefined
                    : true,
                panning: current["data-panning"] !== undefined,
                dragging: current["data-dragging"] !== undefined,
                connecting: current["data-connecting"] !== undefined,
                selecting: current["data-selecting"] !== undefined,
            };
            return renderElement({
                tag: "div",
                as: props.as,
                attrs,
                render: slots.render,
                state,
                ref: rootRef,
                props: { ...current },
                style: ROOT_STYLE,
                children: () => slots.default?.({ state }),
            });
        };
    },
    {
        booleans: ROOT_BOOLEANS,
        types: {
            fitView: [Boolean, Object] as PropType<unknown>,
            // a bare attribute is `true`, mouse buttons (`:pan-on-drag="[1, 2]"`) stay a list
            panOnDrag: [Boolean, Array] as PropType<unknown>,
            autoPan: [Boolean, Object] as PropType<unknown>,
            // `pan-on-scroll-speed="2"` is its number
            panOnScrollSpeed: NUMBER_PROP,
        },
        emits: ROOT_EMITS,
    },
);

/**
 * The flow (`data-flow-part="root"`): owns the model (unless given) and the engine, attaches the
 * engine to its element (the engine listens to it: pointer, wheel, keys, focus) and re-renders
 * when the flow changes. It renders only its default slot; no provider is needed above it. Give
 * it a size (the flow fills it). Another `model` remounts the flow. It takes any features; give
 * it your registry and features with `typedFlow<Types, typeof features>().Root`.
 */
export const Root: FlowComponent<
    RootProps<AnyTypes, FlowFeatures>,
    RootSlots,
    RootEmits
> = defineComponent({
    name: "FlowRoot",
    inheritAttrs: false,
    // a bare boolean attribute reaches RootFlow as it came, which casts it
    props: [...ROOT_PROPS],
    emits: [...ROOT_EMITS],
    setup(props, { attrs, slots, emit }) {
        const forward = Object.fromEntries(
            ROOT_EMITS.map((event) => [
                `on${event[0]?.toUpperCase()}${event.slice(1)}`,
                (...args: unknown[]) =>
                    (emit as (name: string, ...rest: unknown[]) => void)(
                        event,
                        ...args,
                    ),
            ]),
        );
        return () =>
            h(
                RootFlow,
                {
                    ...attrs,
                    ...props,
                    ...forward,
                    key: keyOfModel(
                        (props as { model?: object | undefined }).model,
                    ),
                } as never,
                slots,
            );
    },
}) as unknown as FlowComponent<
    RootProps<AnyTypes, FlowFeatures>,
    RootSlots,
    RootEmits
>;
