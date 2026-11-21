<script module lang="ts">
    import type { Snippet } from "svelte";
    import type { ControlButtonState } from "../runes/use-control-button.svelte.js";
    import type { ButtonPrimitiveProps } from "../utils/render.js";

    export interface ZoomOutProps
        extends Omit<ButtonPrimitiveProps<ControlButtonState>, "children"> {
        /** its content (an icon, a label) */
        children?: Snippet<[{ state: ControlButtonState }]> | undefined;
    }
</script>

<!--
    @component
    A button (`data-flow-part="zoom-out"`): Zooms out by a step around the root's centre (`zoom-out`), disabled at the least zoom. It renders only its
    children (an icon, a label).
-->
<script lang="ts">
    import { useControlButton } from "../runes/use-control-button.svelte.js";
    import {
        elementProps,
        refProps,
        type RenderedProps,
    } from "../utils/render.js";

    let {
        children,
        disabled,
        render,
        class: className,
        style,
        ref = $bindable(),
        ...rest
    }: ZoomOutProps = $props();

    const button = useControlButton("ZoomOut", "zoom-out", () => disabled);
    const refs = refProps((element) => {
        ref = element as HTMLButtonElement | null;
    });
    const attrs: RenderedProps<HTMLButtonElement> = $derived(
        elementProps({
            rest,
            className,
            style,
            state: button.state,
            own: { ...button.props, ...refs },
        }),
    );
</script>

{#snippet content()}{@render children?.({ state: button.state })}{/snippet}

{#if render}
    {@render render({ props: attrs as never, state: button.state, children: content })}
{:else}
    <button {...attrs}>{@render content()}</button>
{/if}
