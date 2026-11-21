<script module lang="ts">
    import type { SvgPrimitiveProps } from "../utils/render.js";

    /** The state of `MiniMapMask`: the root's view, in flow coordinates. */
    export interface MiniMapMaskState {
        readonly view: { x: number; y: number; width: number; height: number };
    }

    export interface MiniMapMaskProps
        extends Omit<
            SvgPrimitiveProps<MiniMapMaskState, SVGPathElement>,
            "children"
        > {}
</script>

<!--
    @component
    The `MiniMap`'s mask (`data-flow-part="minimap-mask"`): an SVG path covering the map but what the
    root shows (`fill-rule="evenodd"`). Give it its fill.
-->
<script lang="ts">
    import { partAttributes } from "@fragiola/flow";
    import {
        elementProps,
        refProps,
        type RenderedProps,
    } from "../utils/render.js";
    import { useMiniMapContext } from "./mini-map-context.js";

    let {
        render,
        class: className,
        style,
        ref = $bindable(),
        ...rest
    }: MiniMapMaskProps = $props();

    const map = useMiniMapContext("MiniMapMask");
    const refs = refProps((element) => {
        ref = element as SVGPathElement | null;
    });
    const partState = $derived<MiniMapMaskState>({ view: map.view.view });
    const attrs: RenderedProps<SVGPathElement> = $derived(
        elementProps({
            rest,
            className,
            style,
            state: partState,
            own: {
                ...partAttributes("minimap-mask"),
                d: map.view.maskPath,
                "fill-rule": "evenodd",
                ...refs,
            },
        }),
    );
</script>

{#snippet content()}{/snippet}

{#if render}
    {@render render({ props: attrs as never, state: partState, children: content })}
{:else}
    <path {...attrs} />
{/if}
