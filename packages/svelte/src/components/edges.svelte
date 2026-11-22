<script module lang="ts">
    import type {
        AnyTypes,
        FlowEdge,
        FlowTypes,
        PartAttributes,
    } from "@fragiola/flow";
    import type { Snippet } from "svelte";
    import type { DivPrimitiveProps } from "../utils/render.js";

    export interface EdgesState {
        /** how many edges are drawn */
        count: number;
    }

    export interface EdgesProps<T extends FlowTypes = AnyTypes>
        extends Omit<DivPrimitiveProps<EdgesState>, "children"> {
        /**
         * draws one edge (`{#snippet children(edge)}`): usually a `Flow.Edge` (an SVG group) with
         * its path and label. Each edge draws again when its edge changes, or when a value the
         * snippet reads does
         */
        children: Snippet<[FlowEdge<T>]>;
    }

    const LAYER_STYLE = {
        position: "absolute",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        overflow: "visible",
        "pointer-events": "none",
    };
    const LAYER_CSS =
        "position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none";

    /** One render level of the edges: its wrapper's attributes, its `z-index`, its edges in order. */
    interface EdgeLevel {
        readonly level: number;
        readonly zIndex: number | undefined;
        readonly attributes: PartAttributes | undefined;
        readonly edges: readonly FlowEdge[];
    }

    function sameLevels(
        a: readonly EdgeLevel[],
        b: readonly EdgeLevel[],
    ): boolean {
        return (
            a.length === b.length &&
            a.every((level, i) => {
                const other = b[i] as EdgeLevel;
                return (
                    level.level === other.level &&
                    level.zIndex === other.zIndex &&
                    shallowEqual(level.attributes ?? {}, other.attributes ?? {}) &&
                    level.edges.length === other.edges.length &&
                    level.edges.every((edge, j) => edge === other.edges[j])
                );
            })
        );
    }

    /** A level wrapper's structural style: the edges' layer, stacked at its level's `z-index`. */
    function levelStyle(zIndex: number | undefined): string {
        return (
            styleString({
                ...LAYER_STYLE,
                ...(zIndex === undefined ? {} : { "z-index": String(zIndex) }),
            }) ?? ""
        );
    }
</script>

<!--
    @component
    The layer of the edges (`data-flow-part="edges"`), inside `Flow.Viewport`, before `Flow.Nodes`:
    an SVG (`data-flow-part="edges"` too) where its children snippet draws each edge, once both its
    nodes have a size, in the engine's drawing order (`drawn-edges`: by `zIndex`), and the HTML
    layer edge labels render into. When edges stand above nodes (`render-layers`: several levels),
    each level is a wrapper (`data-flow-part="edges-layer"`, `data-level`, its `z-index`) holding
    its edges' SVG and its labels, and the nodes interleave with them. Before the engine (the
    server render, the first client render) the edges are the static geometry's. It lets presses
    through to the pane; the edges' own parts take them.
-->
<script lang="ts" generics="T extends FlowTypes = AnyTypes">
    import { edgesLayerAttributes, partAttributes } from "@fragiola/flow";
    import { untrack } from "svelte";
    import type { Attachment } from "svelte/attachments";
    import { setEdgeLabelLayer, useFlowContext } from "../context.js";
    import { flowValue } from "../runes/internal.svelte.js";
    import {
        elementProps,
        refProps,
        type RenderedProps,
        styleString,
    } from "../utils/render.js";
    import { shallowEqual } from "../utils/shallow-equal.js";

    let {
        children,
        render,
        class: className,
        style,
        ref = $bindable(),
        ...rest
    }: EdgesProps<T> = $props();

    const context = useFlowContext("Edges");
    // the render levels: one (today's DOM) unless an edge stands above some node; each with its
    // edges in the core's drawing order (shown, with a size, in view with `onlyRenderVisible`, by
    // z-order), the engine's or, before it, the static geometry's
    const levels = flowValue(
        context,
        (): readonly EdgeLevel[] => {
            const { engine, model, geometry } = context;
            const layers = engine
                ? engine.get("render-layers")
                : (geometry?.layers ?? []);
            if (layers.length <= 1) {
                const edges = engine
                    ? engine.get("drawn-edges")
                    : (layers[0]?.edgeIds ?? []).flatMap((id) => {
                          const edge = model.get("edge-by", { id });
                          return edge ? [edge] : [];
                      });
                return [
                    {
                        level: 0,
                        zIndex: undefined,
                        attributes: undefined,
                        edges,
                    },
                ];
            }
            return layers.map((layer) => ({
                level: layer.level,
                zIndex: layer.zIndex,
                attributes: engine
                    ? engine.adapter.attributes("edges-layer", {
                          level: layer.level,
                      })
                    : edgesLayerAttributes(layer.level),
                edges: layer.edgeIds.flatMap((id) => {
                    const edge = model.get("edge-by", { id });
                    return edge ? [edge] : [];
                }),
            }));
        },
        sameLevels,
    );
    const layered = $derived(levels.current.length > 1);
    const count = $derived(
        levels.current.reduce((sum, level) => sum + level.edges.length, 0),
    );
    // where each edge's labels go: its level's wrapper with several levels, else the edges' element
    const levelOf = $derived(
        new Map(
            levels.current.flatMap((level) =>
                level.edges.map((edge) => [edge.id, level.level] as const),
            ),
        ),
    );
    let layer = $state.raw<HTMLElement | null>(null);
    let levelElements = $state.raw<ReadonlyMap<number, HTMLElement>>(new Map());
    // a level wrapper's element, kept by level (read untracked: the attachment writes the map)
    const levelElement =
        (level: number): Attachment<HTMLElement> =>
        (element) => {
            untrack(() => {
                levelElements = new Map(levelElements).set(level, element);
            });
            return () =>
                untrack(() => {
                    if (levelElements.get(level) !== element) return;
                    const next = new Map(levelElements);
                    next.delete(level);
                    levelElements = next;
                });
        };
    setEdgeLabelLayer({
        elementOf(edgeId) {
            if (!layered) return layer;
            const level = levelOf.get(edgeId);
            return level === undefined
                ? null
                : (levelElements.get(level) ?? null);
        },
    });
    const refs = refProps((element) => {
        layer = element as HTMLElement | null;
        ref = element as HTMLDivElement | null;
    });
    const own = { ...partAttributes("edges"), ...refs };
    const partState = $derived<EdgesState>({ count });
    const attrs: RenderedProps<HTMLDivElement> = $derived(
        elementProps({
            rest,
            className,
            style,
            state: partState,
            own,
            structural: LAYER_STYLE,
        }),
    );
</script>

{#snippet drawn(edges: readonly FlowEdge[])}
    <!-- a layer of edges, not an image: each edge is the consumer's to name -->
    <svg data-flow-part="edges" style={LAYER_CSS}>
        {#each edges as edge (edge.id)}
            {@render children(edge as FlowEdge<T>)}
        {/each}
    </svg>
{/snippet}

{#snippet content()}
    {#if layered}
        {#each levels.current as level (level.level)}
            <div
                {...level.attributes}
                style={levelStyle(level.zIndex)}
                {@attach levelElement(level.level)}
            >
                {@render drawn(level.edges)}
            </div>
        {/each}
    {:else}
        {@render drawn(levels.current[0]?.edges ?? [])}
    {/if}
{/snippet}

{#if render}
    {@render render({ props: attrs as never, state: partState, children: content })}
{:else}
    <div {...attrs}>{@render content()}</div>
{/if}
