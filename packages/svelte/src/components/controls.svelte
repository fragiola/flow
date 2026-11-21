<script module lang="ts">
    import type { Snippet } from "svelte";
    import type { DivPrimitiveProps } from "../utils/render.js";

    /** The state of `Flow.Controls` (none: its buttons have their own). */
    export type ControlsState = Record<never, never>;

    export interface ControlsProps
        extends Omit<DivPrimitiveProps<ControlsState>, "children"> {
        children?: Snippet<[{ state: ControlsState }]> | undefined;
    }

    const STATE: ControlsState = Object.freeze({});
</script>

<!--
    @component
    A group of the viewport's buttons (`data-flow-part="controls"`): `Flow.ZoomIn`, `Flow.ZoomOut`,
    `Flow.FitView`, `Flow.ToggleInteractive`, or your own. Inside `Flow.Root`, outside
    `Flow.Viewport`; presses and the wheel over it are left to it. Place it with your style.
-->
<script lang="ts">
    import { partAttributes } from "@fragiola/flow";
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
    }: ControlsProps = $props();

    const refs = refProps((element) => {
        ref = element as HTMLDivElement | null;
    });
    const own = { ...partAttributes("controls"), ...refs };
    const attrs: RenderedProps<HTMLDivElement> = $derived(
        elementProps({ rest, className, style, state: STATE, own }),
    );
</script>

{#snippet content()}{@render children?.({ state: STATE })}{/snippet}

{#if render}
    {@render render({ props: attrs as never, state: STATE, children: content })}
{:else}
    <div {...attrs}>{@render content()}</div>
{/if}
