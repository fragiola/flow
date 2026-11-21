<script module lang="ts">
    import type { Rect } from "@fragiola/flow";
    import type { Snippet } from "svelte";
    import type { DivPrimitiveProps } from "../utils/render.js";

    export interface SelectionBoxState {
        /** the box, in pixels relative to the root */
        readonly box: Rect;
    }

    export interface SelectionBoxProps
        extends Omit<DivPrimitiveProps<SelectionBoxState>, "children"> {
        children?: Snippet<[{ state: SelectionBoxState }]> | undefined;
    }
</script>

<!--
    @component
    The box selection being drawn (`data-flow-part="selection-box"`, `selection()`): absolutely
    positioned in `Flow.Root` (outside `Flow.Viewport`: it is in screen pixels), rendered only
    while a box is drawn. Give it its look.
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
    }: SelectionBoxProps = $props();

    const context = useFlowContext("SelectionBox");
    const box = flowValue(context, () =>
        context.engine ? context.engine.get("selection-box") : null,
    );
    const attributes = flowValue(
        context,
        () => context.engine?.adapter.attributes("selection-box") ?? {},
    );
    const refs = refProps((element) => {
        ref = element as HTMLDivElement | null;
    });
    const partState = $derived.by((): SelectionBoxState | undefined =>
        box.current ? { box: box.current } : undefined,
    );
    const attrs: RenderedProps<HTMLDivElement> = $derived.by(() => {
        if (!partState) return {} as RenderedProps<HTMLDivElement>;
        const { x, y, width, height } = partState.box;
        return elementProps({
            rest,
            className,
            style,
            state: partState,
            own: {
                ...attributes.current,
                "data-flow-part": "selection-box",
                ...refs,
            },
            structural: {
                position: "absolute",
                left: px(x),
                top: px(y),
                width: px(width),
                height: px(height),
                "pointer-events": "none",
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
