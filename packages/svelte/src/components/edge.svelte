<script module lang="ts">
    import type { AnyTypes, FlowEdge, FlowTypes } from "@fragiola/flow";
    import type { Snippet } from "svelte";
    import type { EdgeState } from "../runes/use-edge.svelte.js";
    import type { SvgPrimitiveProps } from "../utils/render.js";

    export interface EdgeProps<T extends FlowTypes = AnyTypes>
        extends Omit<SvgPrimitiveProps<EdgeState<T>, SVGGElement>, "children"> {
        /** the edge it draws: the one `Flow.Edges` gives its children snippet */
        edge: FlowEdge<T>;
        /** its parts: default a `Flow.EdgePath` */
        children?: Snippet<[{ state: EdgeState<T> }]> | undefined;
    }

    const EDGE_STYLE = { "pointer-events": "visibleStroke" };
</script>

<!--
    @component
    One edge (`data-flow-part="edge"`, `data-flow-id`): an SVG group inside `Flow.Edges`, drawn once
    both its nodes have a size. It renders its children (`Flow.EdgePath` by default,
    `Flow.EdgeLabel`, `Flow.ReconnectAnchor`); a press on its stroke selects it (`selection()`).
-->
<script lang="ts" generics="T extends FlowTypes = AnyTypes">
    import { untrack } from "svelte";
    import { type Attachment, createAttachmentKey } from "svelte/attachments";
    import { setEdgeContext, useFlowContext } from "../context.js";
    import { useEdge } from "../runes/use-edge.svelte.js";
    import {
        elementProps,
        refProps,
        type RenderedProps,
    } from "../utils/render.js";
    import EdgePath from "./edge-path.svelte";

    let {
        edge,
        children,
        render,
        class: className,
        style,
        ref = $bindable(),
        ...rest
    }: EdgeProps<T> = $props();

    const context = useFlowContext("Edge");
    const own = useEdge<T>(() => edge);
    // mounted again (moved to another render level's SVG, keyed by its id): the engine gives it
    // back the focus it had, when the focus was lost meanwhile
    const refocusKey = createAttachmentKey();
    const refocus: Attachment<Element> = (element) => {
        untrack(() => context.engine)?.adapter.refocus(element);
    };
    // the id alone: the parts inside follow another id, not every new edge object
    const edgeId = $derived(edge.id);
    setEdgeContext({
        get edgeId() {
            return edgeId;
        },
    });
    const refs = refProps((element) => {
        ref = element as SVGGElement | null;
    });
    const attrs: RenderedProps<SVGGElement> = $derived(
        elementProps({
            rest,
            className,
            style,
            state: own.state,
            own: { ...own.props, ...refs, [refocusKey]: refocus },
            structural: EDGE_STYLE,
        }),
    );
</script>

{#snippet content()}
    {#if children}
        {@render children({ state: own.state })}
    {:else}
        <EdgePath />
    {/if}
{/snippet}

{#if own.state.path}
    {#if render}
        {@render render({ props: attrs as never, state: own.state, children: content })}
    {:else}
        <g {...attrs}>{@render content()}</g>
    {/if}
{/if}
