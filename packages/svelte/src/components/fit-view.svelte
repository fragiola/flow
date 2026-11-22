<script module lang="ts">
    import type { FitPadding } from "@fragiola/flow";
    import type { Snippet } from "svelte";
    import type { ControlButtonState } from "../runes/use-control-button.svelte.js";
    import type { ButtonPrimitiveProps } from "../utils/render.js";

    export interface FitViewProps
        extends Omit<ButtonPrimitiveProps<ControlButtonState>, "children"> {
        /** how long its viewport change animates, in milliseconds (the root's `easing`); default 0: at once */
        duration?: number | undefined;
        /**
         * the room kept free on every side: a share of the root's size, `"<n>px"`, or each side's
         * (`{ top, right, bottom, left }`); default the engine's 0.1
         */
        padding?: FitPadding | undefined;
        /** only these nodes; default every node that is not hidden */
        nodeIds?: string[] | undefined;
        /** without `nodeIds`, the hidden nodes of known size too; default false */
        includeHidden?: boolean | undefined;
        /** the least zoom it may pick (within the root's limits); default the root's `minZoom` */
        minZoom?: number | undefined;
        /** the greatest zoom it may pick (within the root's limits); default the root's `maxZoom` */
        maxZoom?: number | undefined;
        /** its content (an icon, a label) */
        children?: Snippet<[{ state: ControlButtonState }]> | undefined;
    }
</script>

<!--
    @component
    A button (`data-flow-part="fit-view"`): Fits every node in the root, or its `nodeIds` (`fit-view`, with its props as the payload), disabled before a node is measured. It renders only its
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
        duration,
        padding,
        nodeIds,
        includeHidden,
        minZoom,
        maxZoom,
        render,
        class: className,
        style,
        ref = $bindable(),
        ...rest
    }: FitViewProps = $props();

    const button = useControlButton(
        "FitView",
        "fit-view",
        () => disabled,
        () => ({ duration, padding, nodeIds, includeHidden, minZoom, maxZoom }),
    );
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
