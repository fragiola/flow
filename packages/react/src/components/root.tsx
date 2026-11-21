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
import * as React from "react";
import {
    type AnyFlowEngine,
    eraseModel,
    FlowContext,
    type FlowContextValue,
} from "../context";
import { type FlowRef, setFlowRef } from "../hooks/create-flow-ref";
import { useFlowValue, useIsomorphicLayoutEffect } from "../hooks/internal";
import { createEngineFacade } from "../utils/engine-facade";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";

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
>;

export interface RootProps<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
> extends DivPrimitiveProps<RootState>,
        RootEngineProps {
    /**
     * the flow model. Its middleware (`model.use`) sees every command the flow runs, and its
     * listeners (`model.subscribe`) every change. Give it, or let the root create one from
     * `nodes` / `defaultNodes` and `edges` / `defaultEdges`
     */
    model?: FlowModel<T, F> | undefined;
    /** the nodes of the model the root creates (read once, at mount) */
    defaultNodes?: readonly FlowNodeInput<T>[] | undefined;
    /** the edges of the model the root creates (read once, at mount) */
    defaultEdges?: readonly FlowEdgeInput<T>[] | undefined;
    /**
     * controlled nodes: each render brings the model to them with the commands a user would run
     * (`model.get("commands-to")`, one `batch`); every change of the model's nodes calls
     * `onNodesChange`. Give every node its id
     */
    nodes?: readonly FlowNode<T>[] | undefined;
    /** called with the model's nodes after every command that changes them (a drag step too) */
    onNodesChange?: ((nodes: readonly FlowNode<T>[]) => void) | undefined;
    /** controlled edges, as `nodes` */
    edges?: readonly FlowEdge<T>[] | undefined;
    /** called with the model's edges after every command that changes them */
    onEdgesChange?: ((edges: readonly FlowEdge<T>[]) => void) | undefined;
    /**
     * the opt-in features of the model the root creates (read once, at mount):
     * `[selection(), drag(), connection()]`, each from its entry (`@fragiola/flow-react/drag`). A
     * `model` has its own
     */
    features?: F | undefined;
    /** the id generator of the model the root creates (read once, at mount) */
    createId?: CreateId | undefined;
    /** controlled viewport: a new value is set on the engine (`set-viewport`) */
    viewport?: Viewport | undefined;
    /** the viewport the flow starts at (read once, at mount); default `{ x: 0, y: 0, zoom: 1 }` */
    defaultViewport?: Viewport | undefined;
    /** called on every viewport change, by a gesture (`gesture: true`) or an action */
    onViewportChange?:
        | ((viewport: Viewport, gesture: boolean) => void)
        | undefined;
    /** fits the nodes once they are all measured (read once, at mount) */
    fitView?: boolean | FitViewPayload | undefined;
    /** access to the model and the engine from outside the root (`useFlowRef`, `createFlowRef`) */
    flowRef?: FlowRef<T, F> | undefined;
    children?: React.ReactNode;
}

/** The `meta` of the commands that bring the model to the controlled props. */
const CONTROLLED_META = Object.freeze({ source: "controlled" });

/** A list of features by their names, in order: an equal new list (`features={[drag()]}`) is the same. */
function featureNames(features: FlowFeatures | undefined): string {
    return (features ?? []).map((feature) => feature.name).join(",");
}

/** Warns once per message and root: misuse that the root ignores. */
function useWarnOnce() {
    const warned = React.useRef(new Set<string>());
    return (message: string) => {
        if (warned.current.has(message)) return;
        warned.current.add(message);
        console.warn(`[@fragiola/flow-react] ${message}`);
    };
}

/** Each engine option's value as a key: a new equal object (`pathOptions`) is the same. */
function optionKeys(options: RootEngineProps): Record<string, string> {
    return Object.fromEntries(
        Object.entries(options).map(([key, value]) => [
            key,
            JSON.stringify(value ?? null),
        ]),
    );
}

/** A key that changes when an engine option's value does. */
function optionsKey(options: RootEngineProps): string {
    return JSON.stringify(optionKeys(options));
}

const DEFAULT_VIEWPORT: Viewport = Object.freeze({ x: 0, y: 0, zoom: 1 });

const ROOT_STYLE: React.CSSProperties = {
    position: "relative",
    overflow: "hidden",
};

/**
 * The flow (`data-flow-part="root"`): owns the model (unless given) and the engine, attaches the
 * engine to its element (the engine listens to it: pointer, wheel, keys, focus) and re-renders
 * when the flow changes. It renders only its children; no Provider is needed above it. Give it a
 * size (the flow fills it).
 */
export function Root<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
>(props: RootProps<T, F>) {
    const {
        model: modelProp,
        defaultNodes,
        defaultEdges,
        nodes,
        onNodesChange,
        edges,
        onEdgesChange,
        features,
        createId,
        viewport,
        defaultViewport,
        onViewportChange,
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
        children,
        ...rest
    } = props;
    const [ownModel] = React.useState(() =>
        modelProp
            ? null
            : createFlowModel<T, F>(
                  {
                      version: 1,
                      nodes: [...(nodes ?? defaultNodes ?? [])],
                      edges: [...(edges ?? defaultEdges ?? [])],
                  } as never,
                  { features, createId },
              ),
    );
    const typed = (modelProp ?? ownModel) as FlowModel<T, F>;
    // the parts below work on the erased registry; the typed surface is their props
    const model = eraseModel(typed);

    // the features are the model's, fixed when it is created: a later change is ignored
    const warn = useWarnOnce();
    const [firstFeatures] = React.useState(() => featureNames(features));
    if (!modelProp && featureNames(features) !== firstFeatures) {
        warn(
            "the features prop changed after the root created its model: the change is ignored (the features are fixed when the model is created)",
        );
    }

    const engineProps: RootEngineProps = {
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
    };
    const engineKey = optionsKey(engineProps);
    // the callbacks and the creation options are read when needed: a new function each render
    // recreates nothing
    const latest = React.useRef({
        onNodesChange,
        onEdgesChange,
        onViewportChange,
        engineProps,
        start: viewport ?? defaultViewport ?? DEFAULT_VIEWPORT,
        fitView,
    });
    latest.current = {
        ...latest.current,
        onNodesChange,
        onEdgesChange,
        onViewportChange,
        engineProps,
    };

    const [facade] = React.useState(() =>
        createEngineFacade(viewport ?? defaultViewport ?? DEFAULT_VIEWPORT),
    );
    const [engine, setEngine] = React.useState<AnyFlowEngine | null>(null);
    // the engine options last sent, by key: a change sends only the keys that changed (an
    // `interactive` that stays must not undo the lock of `Flow.ToggleInteractive`)
    const sentOptions = React.useRef<Record<string, string>>({});
    // the engine is created once mounted, in the commit (StrictMode's second mount creates a new
    // one), so that no render ever attaches or observes anything
    useIsomorphicLayoutEffect(() => {
        const { start, fitView: fit, engineProps: options } = latest.current;
        const created = createFlowEngine(model, {
            ...options,
            // a remount (StrictMode) starts where the last engine was
            defaultViewport: facade.current?.get("viewport") ?? start,
            fitView: fit,
        }) as unknown as AnyFlowEngine;
        sentOptions.current = optionKeys(options);
        facade.set(created as unknown as FlowEngine);
        setEngine(created);
        const stop = created.subscribe((event) => {
            if (event.type === "viewport-change") {
                latest.current.start = event.viewport;
                latest.current.onViewportChange?.(
                    event.viewport,
                    event.gesture,
                );
            }
        });
        return () => {
            stop();
            facade.set(null);
            created.destroy();
        };
    }, [model, facade]);
    // a destroyed engine (StrictMode's first mount, a replaced model) is never used again
    const live = engine && engine.adapter.model === model ? engine : null;

    // the engine options that changed since they were sent
    useIsomorphicLayoutEffect(() => {
        if (!live) return;
        const next = optionKeys(latest.current.engineProps);
        const changed = Object.keys(next).filter(
            (key) => next[key] !== sentOptions.current[key],
        );
        sentOptions.current = next;
        if (changed.length === 0) return;
        const props = latest.current.engineProps as Record<string, unknown>;
        live.adapter.setOptions(
            Object.fromEntries(changed.map((key) => [key, props[key]])),
        );
    }, [live, engineKey]);

    // a controlled viewport that differs from the engine's is set on it
    useIsomorphicLayoutEffect(() => {
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
    }, [live, viewport?.x, viewport?.y, viewport?.zoom]);

    // onNodesChange / onEdgesChange on every commit that changes them, but the controlled props'
    useIsomorphicLayoutEffect(
        () =>
            model.subscribe((event: CommandEvent) => {
                if (event.meta?.source === CONTROLLED_META.source) return;
                const {
                    onNodesChange: nodesChanged,
                    onEdgesChange: edgesChanged,
                } = latest.current;
                if (event.before.nodes !== event.after.nodes) {
                    nodesChanged?.(event.after.nodes as readonly FlowNode<T>[]);
                }
                if (event.before.edges !== event.after.edges) {
                    edgesChanged?.(event.after.edges as readonly FlowEdge<T>[]);
                }
            }),
        [model],
    );

    // the controlled lists the model was last brought to (a model the root created starts at them)
    const sent = React.useRef<{
        model: unknown;
        nodes: unknown;
        edges: unknown;
    }>({ model: ownModel, nodes, edges });
    useIsomorphicLayoutEffect(() => {
        const previous = sent.current;
        const sameModel = previous.model === model;
        // only a list that changed is diffed (an edge list that stays is not walked on each step)
        const target = {
            nodes: (sameModel && previous.nodes === nodes
                ? undefined
                : nodes) as readonly FlowNode[] | undefined,
            edges: (sameModel && previous.edges === edges
                ? undefined
                : edges) as readonly FlowEdge[] | undefined,
        };
        sent.current = { model, nodes, edges };
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
                if (!result.ok)
                    refused.push(`${entry.command}: ${result.error.message}`);
            }
            warn(
                `the controlled nodes / edges were not all applied (the model's are reported back):\n${refused.join("\n")}`,
            );
        }
        // what the model holds when it differs from the props (a veto, a rule that kept a node
        // in its parent, a middleware that rewrote a payload): the app's state follows the model
        const { onNodesChange: nodesChanged, onEdgesChange: edgesChanged } =
            latest.current;
        if (
            target.nodes !== undefined &&
            model.get("commands-to", { nodes: target.nodes }).length > 0
        ) {
            nodesChanged?.(model.get("all-nodes") as readonly FlowNode<T>[]);
        }
        if (
            target.edges !== undefined &&
            model.get("commands-to", { edges: target.edges }).length > 0
        ) {
            edgesChanged?.(model.get("all-edges") as readonly FlowEdge<T>[]);
        }
    });

    useIsomorphicLayoutEffect(() => {
        if (!flowRef) return;
        const ref = flowRef as unknown as FlowRef<FlowTypes, FlowFeatures>;
        setFlowRef(ref, {
            model: typed as unknown as FlowModel<FlowTypes, FlowFeatures>,
            engine: facade.engine as unknown as FlowEngine<
                FlowTypes,
                FlowFeatures
            >,
        });
        return () => setFlowRef(ref, null);
    }, [flowRef, typed, facade]);

    const [rootElement, setRootElement] = React.useState<HTMLElement | null>(
        null,
    );
    const rootRef = React.useCallback(
        (element: HTMLElement | null) => {
            setRootElement(element);
            if (!element || !live) return;
            live.adapter.attachRoot(element);
            return () => live.adapter.detachRoot();
        },
        [live],
    );

    const attributes = useFlowValue(model, live, () =>
        live ? live.adapter.attributes("root") : partAttributes("root"),
    );
    const state: RootState = {
        interactive: live ? attributes["data-interactive"] !== undefined : true,
        panning: attributes["data-panning"] !== undefined,
        dragging: attributes["data-dragging"] !== undefined,
        connecting: attributes["data-connecting"] !== undefined,
        selecting: attributes["data-selecting"] !== undefined,
    };
    const context = React.useMemo<FlowContextValue>(
        () => ({
            model,
            engine: live,
            publicEngine: facade.engine as unknown as AnyFlowEngine,
            rootElement,
        }),
        [model, live, facade, rootElement],
    );
    const element = useRenderElement("div", rest, {
        state,
        ref: rootRef as React.Ref<Element>,
        props: { ...attributes, children },
        style: ROOT_STYLE,
    });
    return (
        <FlowContext.Provider value={context}>{element}</FlowContext.Provider>
    );
}
