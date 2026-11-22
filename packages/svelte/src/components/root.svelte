<script module lang="ts">
    import {
        type AnyTypes,
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
        type FlowEngineEventOf,
        type FlowEngineOptions,
        type FlowFeatures,
        type FlowModel,
        type FlowNode,
        type FlowNodeInput,
        type FlowTypes,
        partAttributes,
        type StaticGeometry,
        staticGeometry,
        type Viewport,
    } from "@fragiola/flow";
    import type { Snippet } from "svelte";
    import type { FlowRef } from "../runes/create-flow-ref.svelte.js";
    import type { DivPrimitiveProps } from "../utils/render.js";

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
        | "zIndexMode"
        | "paneClickDistance"
        | "nodeClickDistance"
        | "preventScrolling"
        | "nodesFocusable"
        | "edgesFocusable"
    >;

    type Callbacks = typeof ENGINE_EVENT_CALLBACKS;

    /**
     * The root's event callbacks, one per engine event (`ENGINE_EVENT_CALLBACKS`), lowercase as
     * Svelte's event props: `onnodeclick`, `onmovestart`, `onconnectcancel`, … each called with
     * the event.
     */
    export type RootEventProps = {
        [K in keyof Callbacks as `on${Lowercase<Callbacks[K]>}`]?:
            | ((event: FlowEngineEventOf<K>) => void)
            | undefined;
    };

    /** Each engine event's callback prop, from the core's table (`node-click` → `onnodeclick`). */
    const CALLBACK_BY_TYPE: ReadonlyMap<string, string> = new Map(
        Object.entries(ENGINE_EVENT_CALLBACKS).map(([type, name]) => [
            type,
            `on${name.toLowerCase()}`,
        ]),
    );
    const CALLBACK_PROPS: ReadonlySet<string> = new Set(
        CALLBACK_BY_TYPE.values(),
    );

    export interface RootProps<
        T extends FlowTypes = AnyTypes,
        F extends FlowFeatures = readonly [],
    > extends Omit<DivPrimitiveProps<RootState>, "children">,
            RootEngineProps,
            RootEventProps {
        /**
         * the flow model. Its middleware (`model.use`) sees every command the flow runs, and its
         * listeners (`model.subscribe`) every change. Give it, or let the root create one from
         * `nodes` / `defaultNodes` and `edges` / `defaultEdges`. Another model gets another engine
         */
        model?: FlowModel<T, F> | undefined;
        /** the nodes of the model the root creates (read once, at mount) */
        defaultNodes?: readonly FlowNodeInput<T>[] | undefined;
        /** the edges of the model the root creates (read once, at mount) */
        defaultEdges?: readonly FlowEdgeInput<T>[] | undefined;
        /**
         * controlled nodes (`bind:nodes`, or `nodes` with `onnodeschange`): a new list brings the
         * model to it with the commands a user would run (`model.get("commands-to")`, one
         * `batch`); every change of the model's nodes is written back and told to
         * `onnodeschange`. Give every node its id
         */
        nodes?: readonly FlowNode<T>[] | undefined;
        /** called with the model's nodes after every command that changes them (a drag step too) */
        onnodeschange?: ((nodes: readonly FlowNode<T>[]) => void) | undefined;
        /** controlled edges (`bind:edges`, or `edges` with `onedgeschange`), as `nodes` */
        edges?: readonly FlowEdge<T>[] | undefined;
        /** called with the model's edges after every command that changes them */
        onedgeschange?: ((edges: readonly FlowEdge<T>[]) => void) | undefined;
        /**
         * the opt-in features of the model the root creates (read once, at mount):
         * `[selection(), drag(), connection()]`, each from its entry
         * (`@fragiola/flow-svelte/drag`). A `model` has its own
         */
        features?: F | undefined;
        /** the id generator of the model the root creates (read once, at mount) */
        createId?: CreateId | undefined;
        /**
         * the fields every `edge.add` of the model the root creates fills in where it leaves them
         * out (read once, at mount: the model option `defaultEdgeOptions`)
         */
        defaultEdgeOptions?: DefaultEdgeOptions<T> | undefined;
        /**
         * controlled viewport (`bind:viewport`, or `viewport` with `onviewportchange`): a new value
         * is set on the engine (`set-viewport`), every change is written back
         */
        viewport?: Viewport | undefined;
        /** the viewport the flow starts at (read once, at mount); default `{ x: 0, y: 0, zoom: 1 }` */
        defaultViewport?: Viewport | undefined;
        /** called on every viewport change, by a gesture (`gesture: true`) or an action */
        onviewportchange?:
            | ((viewport: Viewport, gesture: boolean) => void)
            | undefined;
        /** fits the nodes once they are all measured (read once, at mount) */
        fitView?: boolean | FitViewPayload | undefined;
        /** access to the model and the engine from outside the root (`useFlowRef`, `createFlowRef`) */
        flowRef?: FlowRef<T, F> | undefined;
        /** the flow: `Flow.Background`, `Flow.Viewport`, `Flow.Controls`, `MiniMap`, … */
        children?: Snippet<[{ state: RootState }]> | undefined;
    }

    /** The `meta` of the commands that bring the model to the controlled props. */
    const CONTROLLED_META = Object.freeze({ source: "controlled" });

    const DEFAULT_VIEWPORT: Viewport = Object.freeze({ x: 0, y: 0, zoom: 1 });

    const ROOT_STYLE = { position: "relative", overflow: "hidden" };

    /** A list of features by their names, in order: an equal new list is the same. */
    function featureNames(list: FlowFeatures | undefined): string {
        return (list ?? []).map((feature) => feature.name).join(",");
    }

    /**
     * Each engine option's value as a key: a new equal object (`pathOptions`) is the same, a
     * function (`easing`) is itself, and `null` (`panActivationKey={null}`: none) is not
     * `undefined` (the default).
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
</script>

<script
    lang="ts"
    generics="T extends FlowTypes = AnyTypes, F extends FlowFeatures = readonly []"
>
    import { onDestroy, untrack } from "svelte";
    import { createAttachmentKey } from "svelte/attachments";
    import {
        type AnyFlowEngine,
        eraseModel,
        type FlowContextValue,
        setFlowContext,
    } from "../context.js";
    import { setFlowRef } from "../runes/create-flow-ref.svelte.js";
    import { flowValue } from "../runes/internal.svelte.js";
    import { createEngineFacade } from "../utils/engine-facade.js";
    import { plain, plainList, warnOnce } from "../utils/plain.svelte.js";
    import {
        elementProps,
        refProps,
        type RenderedProps,
    } from "../utils/render.js";

    let {
        model: modelProp,
        defaultNodes,
        defaultEdges,
        nodes = $bindable(),
        onnodeschange,
        edges = $bindable(),
        onedgeschange,
        features,
        createId,
        defaultEdgeOptions,
        viewport = $bindable(),
        defaultViewport,
        onviewportchange,
        fitView,
        flowRef,
        minZoom,
        maxZoom,
        translateExtent,
        panOnDrag,
        panOnScroll,
        zoomOnScroll,
        zoomOnPinch,
        zoomOnDoubleClick,
        zoomStep,
        interactive,
        onlyRenderVisible,
        pathOptions,
        autoPan,
        panActivationKey,
        panOnScrollMode,
        panOnScrollSpeed,
        zoomActivationKey,
        easing,
        nodeOrigin,
        nodeExtent,
        elevateNodesOnSelect,
        elevateEdgesOnSelect,
        zIndexMode,
        paneClickDistance,
        nodeClickDistance,
        preventScrolling,
        nodesFocusable,
        edgesFocusable,
        children,
        render,
        class: className,
        style,
        ref = $bindable(),
        ...rest
    }: RootProps<T, F> = $props();

    // the model the root creates when none is given: once, from the props it starts with
    let ownModel: FlowModel<T, F> | undefined;
    const typed = $derived.by((): FlowModel<T, F> => {
        if (modelProp) return modelProp;
        ownModel ??= untrack(() =>
            createFlowModel<T, F>(
                {
                    version: 1,
                    nodes: [
                        ...((plainList(nodes) ?? plainList(defaultNodes)) ??
                            []),
                    ],
                    edges: [
                        ...((plainList(edges) ?? plainList(defaultEdges)) ??
                            []),
                    ],
                } as never,
                {
                    features: plainList(features) as F | undefined,
                    createId,
                    defaultEdgeOptions: plain(defaultEdgeOptions),
                },
            ),
        );
        return ownModel;
    });
    // the parts below work on the erased registry; the typed surface is their props
    const model = $derived(eraseModel(typed));

    // the features are the model's, fixed when it is created: a later change is ignored
    const warn = warnOnce();
    const firstFeatures = untrack(() => featureNames(features));
    $effect(() => {
        if (!modelProp && featureNames(features) !== firstFeatures) {
            warn(
                "the features prop changed after the root created its model: the change is ignored (the features are fixed when the model is created)",
            );
        }
    });

    const engineProps = (): RootEngineProps => ({
        minZoom,
        maxZoom,
        translateExtent: plain(translateExtent),
        panOnDrag: plain(panOnDrag),
        panOnScroll,
        zoomOnScroll,
        zoomOnPinch,
        zoomOnDoubleClick,
        zoomStep,
        interactive,
        onlyRenderVisible,
        pathOptions: plain(pathOptions),
        autoPan: plain(autoPan),
        panActivationKey,
        panOnScrollMode,
        panOnScrollSpeed,
        zoomActivationKey,
        easing,
        nodeOrigin: plain(nodeOrigin),
        nodeExtent: plain(nodeExtent),
        elevateNodesOnSelect,
        elevateEdgesOnSelect,
        zIndexMode,
        paneClickDistance,
        nodeClickDistance,
        preventScrolling,
        nodesFocusable,
        edgesFocusable,
    });
    // the viewport a new engine starts at: the last one's (another model), else the props'
    let start: Viewport = untrack(() =>
        plain(viewport ?? defaultViewport ?? DEFAULT_VIEWPORT),
    );
    const facade = createEngineFacade(start);
    let engine = $state.raw<AnyFlowEngine | null>(null);
    let revision = $state(0);
    let rootElement = $state.raw<HTMLElement | null>(null);
    const bump = () => {
        revision++;
    };

    // the model's lists written back to `bind:nodes` / `bind:edges`, and what the props read back:
    // a parent that keeps them in a deep `$state` proxies what it is given, and a proxy of a frozen
    // list breaks on its first write (`push`), so such a parent gets a copy (its entries stay the
    // model's frozen ones); a `$state.raw` or a prop gets the model's list itself
    const writeNodes = (next: readonly FlowNode<T>[]) => {
        nodes = next;
        if (nodes !== next) nodes = [...next];
        return nodes;
    };
    const writeEdges = (next: readonly FlowEdge<T>[]) => {
        edges = next;
        if (edges !== next) edges = [...next];
        return edges;
    };

    // the model's changes: every part reads them through `revision`; the app hears them through
    // the bound lists and the callbacks, but the controlled props' own commands
    $effect.pre(() => {
        const current = model;
        return current.subscribe((event: CommandEvent) => {
            bump();
            if (event.meta?.source === CONTROLLED_META.source) return;
            if (event.before.nodes !== event.after.nodes) {
                const next = event.after.nodes as readonly FlowNode<T>[];
                if (nodes !== undefined) {
                    // written back as the model holds them: nothing to bring the model to
                    sent = { ...sent, nodes: writeNodes(next) };
                }
                onnodeschange?.(next);
            }
            if (event.before.edges !== event.after.edges) {
                const next = event.after.edges as readonly FlowEdge<T>[];
                if (edges !== undefined) {
                    sent = { ...sent, edges: writeEdges(next) };
                }
                onedgeschange?.(next);
            }
        });
    });

    // the controlled lists the model was last brought to (a model the root created starts at them)
    let sent = untrack(() => ({
        model: modelProp ? undefined : model,
        nodes,
        edges,
    }));
    const syncControlled = (
        current: typeof model,
        nextNodes: unknown,
        nextEdges: unknown,
    ) => {
        const sameModel = sent.model === current;
        // only a list that changed is diffed (an edge list that stays is not walked on each step)
        const target = {
            nodes: (sameModel && sent.nodes === nextNodes
                ? undefined
                : plainList(nextNodes as readonly FlowNode[] | undefined)) as
                | readonly FlowNode[]
                | undefined,
            edges: (sameModel && sent.edges === nextEdges
                ? undefined
                : plainList(nextEdges as readonly FlowEdge[] | undefined)) as
                | readonly FlowEdge[]
                | undefined,
        };
        sent = {
            model: current,
            nodes: nextNodes as typeof nodes,
            edges: nextEdges as typeof edges,
        };
        if (target.nodes === undefined && target.edges === undefined) return;
        const commands = current.get("commands-to", target);
        if (commands.length === 0) return;
        const options = { meta: CONTROLLED_META };
        if (!current.run("batch", { commands: [...commands] }, options).ok) {
            // refused as a whole (a middleware's veto): each change that may be made is, and the
            // app hears what the model holds instead
            const refused: string[] = [];
            for (const entry of commands) {
                const result = current.run(
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
        // what the model holds when it differs from the props (a veto, a rule that kept a node
        // in its parent, a middleware that rewrote a payload): the app's state follows the model
        if (
            target.nodes !== undefined &&
            current.get("commands-to", { nodes: target.nodes }).length > 0
        ) {
            const held = current.get("all-nodes") as readonly FlowNode<T>[];
            sent = { ...sent, nodes: writeNodes(held) };
            onnodeschange?.(held);
        }
        if (
            target.edges !== undefined &&
            current.get("commands-to", { edges: target.edges }).length > 0
        ) {
            const held = current.get("all-edges") as readonly FlowEdge<T>[];
            sent = { ...sent, edges: writeEdges(held) };
            onedgeschange?.(held);
        }
    };
    // on the client only (a server render neither changes a model that may be shared by other
    // requests, nor subscribes to it), before the parts render: a model the app gives starts at
    // the props
    $effect.pre(() => {
        const current = model;
        const nextNodes = nodes;
        const nextEdges = edges;
        untrack(() => syncControlled(current, nextNodes, nextEdges));
    });

    // the engine options last sent, by key: a change sends only the keys that changed (an
    // `interactive` that stays must not undo the lock of `Flow.ToggleInteractive`)
    let sentOptions: Record<string, unknown> = {};
    // the engine is created once mounted (a server render never attaches or observes anything),
    // one per model; the parts attach to it through their attachments, which read `engine`
    $effect(() => {
        const current = model;
        const created = untrack(() => {
            const options = engineProps();
            const made = createFlowEngine(current, {
                ...options,
                defaultViewport: { ...start },
                fitView: plain(fitView),
            }) as unknown as AnyFlowEngine;
            sentOptions = optionKeys(options);
            return made;
        });
        const stops = [
            created.adapter.subscribe(bump),
            created.subscribe((event) => {
                if (event.type !== "viewport-change") {
                    // the event's callback (`onnodeclick`, `onmovestart`, …): the latest prop
                    const name = CALLBACK_BY_TYPE.get(event.type);
                    const callback = name
                        ? untrack(() => (rest as Record<string, unknown>)[name])
                        : undefined;
                    if (typeof callback === "function") callback(event);
                    return;
                }
                start = event.viewport;
                // a copy: the engine's viewport is frozen, and a parent's deep `$state` would proxy it
                if (viewport !== undefined) viewport = { ...event.viewport };
                onviewportchange?.(event.viewport, event.gesture);
            }),
        ];
        facade.set(created as unknown as FlowEngine);
        engine = created;
        return () => {
            for (const stop of stops) stop();
            facade.set(null);
            engine = null;
            created.destroy();
        };
    });

    // the engine options that changed since they were sent
    $effect(() => {
        const live = engine;
        const options = engineProps();
        if (!live) return;
        untrack(() => {
            const next = optionKeys(options);
            const changed = Object.keys(next).filter(
                (key) => next[key] !== sentOptions[key],
            );
            sentOptions = next;
            if (changed.length === 0) return;
            const values = options as Record<string, unknown>;
            live.adapter.setOptions(
                Object.fromEntries(changed.map((key) => [key, values[key]])),
            );
        });
    });

    // a controlled viewport that differs from the engine's is set on it
    $effect(() => {
        const live = engine;
        const x = viewport?.x;
        const y = viewport?.y;
        const zoom = viewport?.zoom;
        if (!live || x === undefined || y === undefined || zoom === undefined) {
            return;
        }
        untrack(() => {
            const current = live.get("viewport");
            if (current.x !== x || current.y !== y || current.zoom !== zoom) {
                live.run("set-viewport", { x, y, zoom });
            }
        });
    });

    // the flow ref: the model and the facade (the same object across engines)
    $effect(() => {
        const held = flowRef as unknown as FlowRef<FlowTypes, FlowFeatures>;
        const current = typed;
        if (!held) return;
        untrack(() =>
            setFlowRef(held, {
                model: current as unknown as FlowModel<FlowTypes, FlowFeatures>,
                engine: facade.engine as unknown as FlowEngine<
                    FlowTypes,
                    FlowFeatures
                >,
            }),
        );
        return () => setFlowRef(held, null);
    });

    // the geometry before the engine (the server render and the first client render): the pure
    // function the engine falls back to, over the model's document and the options the engine
    // gets, so the server's output, the first client render and the engine agree (no hydration
    // mismatch, no jump). Computed again only for another document or other options
    let lastGeometry:
        | {
              nodes: unknown;
              edges: unknown;
              options: string;
              geometry: StaticGeometry;
          }
        | undefined;
    const geometry = $derived.by((): StaticGeometry | null => {
        revision;
        if (engine) {
            lastGeometry = undefined;
            return null;
        }
        const current = model;
        const flow = {
            nodes: current.get("all-nodes"),
            edges: current.get("all-edges"),
        };
        const options = {
            nodeOrigin: plain(nodeOrigin),
            pathOptions: plain(pathOptions),
            zIndexMode,
            elevateNodesOnSelect,
            elevateEdgesOnSelect,
        };
        const key = JSON.stringify(options);
        if (
            lastGeometry?.nodes === flow.nodes &&
            lastGeometry.edges === flow.edges &&
            lastGeometry.options === key
        ) {
            return lastGeometry.geometry;
        }
        const made = staticGeometry(flow, options);
        lastGeometry = { ...flow, options: key, geometry: made };
        return made;
    });

    const context: FlowContextValue = {
        get model() {
            return model;
        },
        get engine() {
            return engine;
        },
        publicEngine: facade.engine as unknown as AnyFlowEngine,
        get rootElement() {
            return rootElement;
        },
        get revision() {
            return revision;
        },
        get geometry() {
            return geometry;
        },
    };
    setFlowContext(context);
    onDestroy(() => {
        rootElement = null;
    });

    // the element: the consumer's `ref` and the root element toolbars render into
    const refs = refProps((element) => {
        if (element) rootElement = element as HTMLElement;
        ref = element as HTMLDivElement | null;
    });
    // the engine listens to it (pointer, wheel, keys, focus): attached again to a new engine
    const engineKey = createAttachmentKey();
    const engineAttachment = (element: Element) => {
        const live = engine;
        if (!live) return;
        live.adapter.attachRoot(element as HTMLElement);
        return () => live.adapter.detachRoot();
    };

    // the consumer's props for the element, without the event callbacks (never a listener of an
    // element event `nodeclick`); a spread keeps the symbol keys (the consumer's `{@attach}`)
    const elementRest = $derived.by(() => {
        const copy: Record<string | symbol, unknown> = { ...rest };
        for (const name of CALLBACK_PROPS) delete copy[name];
        return copy as typeof rest;
    });

    const attributes = flowValue(context, () =>
        engine ? engine.adapter.attributes("root") : partAttributes("root"),
    );
    const partState = $derived.by((): RootState => {
        const current = attributes.current;
        return {
            interactive: engine
                ? current["data-interactive"] !== undefined
                : true,
            panning: current["data-panning"] !== undefined,
            dragging: current["data-dragging"] !== undefined,
            connecting: current["data-connecting"] !== undefined,
            selecting: current["data-selecting"] !== undefined,
        };
    });
    const attrs: RenderedProps<HTMLDivElement> = $derived(
        elementProps({
            rest: elementRest,
            className,
            style,
            state: partState,
            own: {
                ...attributes.current,
                ...refs,
                [engineKey]: engineAttachment,
            },
            // the engine writes `touch-action: none` on its root: written here too, so that a new
            // style string of the consumer's never takes it away
            structural: engine
                ? { ...ROOT_STYLE, "touch-action": "none" }
                : ROOT_STYLE,
        }),
    );
</script>

{#snippet content()}{@render children?.({ state: partState })}{/snippet}

{#if render}
    {@render render({ props: attrs as never, state: partState, children: content })}
{:else}
    <div {...attrs}>{@render content()}</div>
{/if}
