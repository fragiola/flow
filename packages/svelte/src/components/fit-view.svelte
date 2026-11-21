<script module lang="ts">
    import type { Snippet } from "svelte";
    import type { ControlButtonState } from "../runes/use-control-button.svelte.js";
    import type { ButtonPrimitiveProps } from "../utils/render.js";

    export interface FitViewProps
        extends Omit<ButtonPrimitiveProps<ControlButtonState>, "children"> {
        /** its content (an icon, a label) */
        children?: Snippet<[{ state: ControlButtonState }]> | undefined;
    }
</script>

<!--
    @component
    A button (`data-flow-part="fit-view"`): Fits every node in the root (`fit-view`), disabled before a node is measured. It renders only its
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
    }: FitViewProps = $props();

    const button = useControlButton("FitView", "fit-view", () => disabled);
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
