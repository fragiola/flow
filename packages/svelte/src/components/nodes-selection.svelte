<script module lang="ts">
    import type { Rect } from "@fragiola/flow";
    import type { Snippet } from "svelte";
    import type { DivPrimitiveProps } from "../utils/render.js";

    export interface NodesSelectionState {
        /** the rectangle around the selected nodes, in flow coordinates */
        readonly rect: Rect;
        /** the selection is being dragged by it: `data-dragging` */
        readonly dragging: boolean;
    }

    export interface NodesSelectionProps
        extends Omit<DivPrimitiveProps<NodesSelectionState>, "children"> {
        children?: Snippet<[{ state: NodesSelectionState }]> | undefined;
    }
</script>

<!--
    @component
    The rectangle around the selected nodes (`data-flow-part="nodes-selection"`, `selection()`),
    inside `Flow.Viewport` next to `Flow.Nodes` (it is in flow coordinates): rendered at
    `selection-rect`, while two or more nodes are selected by a box (or always, with
    `selection({ rect: "always" })`). A press on it drags the selection (`drag()`), its context
    menu is the selection's. With `keyboard()` it takes focus (`tabindex`), and its keys are a
    focused selected node's: the arrows move the selection, the delete keys remove it, Escape
    clears it. Give it its look.
-->
<script lang="ts">
    import { useFlowContext } from "../context.js";
    import { flowValue } from "../runes/internal.svelte.js";
    import {
        elementProps,
        px,
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
    }: NodesSelectionProps = $props();

    const context = useFlowContext("NodesSelection");
    const rect = flowValue(context, () =>
        context.engine ? (context.engine.get("selection-rect") ?? null) : null,
    );
    const attributes = flowValue(
        context,
        () => context.engine?.adapter.attributes("nodes-selection") ?? {},
    );
    const refs = refProps((element) => {
        ref = element as HTMLDivElement | null;
    });
    const partState = $derived.by((): NodesSelectionState | undefined =>
        rect.current
            ? {
                  rect: rect.current,
                  dragging: attributes.current["data-dragging"] !== undefined,
              }
            : undefined,
    );
    const attrs: RenderedProps<HTMLDivElement> = $derived.by(() => {
        if (!partState) return {} as RenderedProps<HTMLDivElement>;
        const { x, y, width, height } = partState.rect;
        return elementProps({
            rest,
            className,
            style,
            state: partState,
            own: {
                ...attributes.current,
                "data-flow-part": "nodes-selection",
                ...refs,
            },
            structural: {
                position: "absolute",
                top: "0",
                left: "0",
                transform: `translate(${px(x)}, ${px(y)})`,
                width: px(width),
                height: px(height),
            },
        });
    });
</script>

{#snippet content()}
    {#if partState}{@render children?.({ state: partState })}{/if}
{/snippet}

{#if partState}
    {#if render}
        {@render render({ props: attrs as never, state: partState, children: content })}
    {:else}
        <div {...attrs}>{@render content()}</div>
    {/if}
{/if}
