<script module lang="ts">
    import type { AnyTypes, FlowEdge, FlowTypes } from "@fragiola/flow";
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
</script>

<!--
    @component
    The layer of the edges (`data-flow-part="edges"`), inside `Flow.Viewport`, before `Flow.Nodes`:
    an SVG (`data-flow-part="edges"` too) where its children snippet draws each edge, once both its
    nodes have a size (`edge-path-by`), and the HTML layer edge labels render into. It lets presses
    through to the pane; the edges' own parts take them.
-->
<script lang="ts" generics="T extends FlowTypes = AnyTypes">
    import { partAttributes } from "@fragiola/flow";
    import { setEdgeLabelLayer, useFlowContext } from "../context.js";
    import { flowValue } from "../runes/internal.svelte.js";
    import {
        elementProps,
        refProps,
        type RenderedProps,
    } from "../utils/render.js";

    let {
        children,
        render,
        class: className,
        style,
        ref = $bindable(),
        ...rest
    }: EdgesProps<T> = $props();

    const context = useFlowContext("Edges");
    const list = flowValue(context, () => {
        const { engine, model } = context;
        if (!engine) return [] as readonly FlowEdge<T>[];
        const edges = engine.adapter.settings.onlyRenderVisible
            ? engine.get("visible-edges")
            : model
                  .get("all-edges")
                  .filter(
                      (edge) =>
                          edge.hidden !== true &&
                          model.get("node-by", { id: edge.source })?.hidden !==
                              true &&
                          model.get("node-by", { id: edge.target })?.hidden !==
                              true,
                  );
        return edges.filter(
            (edge) =>
                engine.get("edge-path-by", { edgeId: edge.id }) !== undefined,
        ) as unknown as readonly FlowEdge<T>[];
    });
    let layer = $state.raw<HTMLElement | null>(null);
    setEdgeLabelLayer({
        get element() {
            return layer;
        },
    });
    const refs = refProps((element) => {
        layer = element as HTMLElement | null;
        ref = element as HTMLDivElement | null;
    });
    const own = { ...partAttributes("edges"), ...refs };
    const partState = $derived<EdgesState>({ count: list.current.length });
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

{#snippet content()}
    <!-- a layer of edges, not an image: each edge is the consumer's to name -->
    <svg data-flow-part="edges" style={LAYER_CSS}>
        {#each list.current as edge (edge.id)}
            {@render children(edge)}
        {/each}
    </svg>
{/snippet}

{#if render}
    {@render render({ props: attrs as never, state: partState, children: content })}
{:else}
    <div {...attrs}>{@render content()}</div>
{/if}
