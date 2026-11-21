<script module lang="ts">
    import type { BackgroundPattern, BackgroundVariant } from "@fragiola/flow";
    import type { SvgPrimitiveProps } from "../utils/render.js";

    export interface BackgroundState {
        /** the pattern's tile on the screen, at the current viewport */
        readonly pattern: BackgroundPattern;
    }

    export interface BackgroundProps
        extends Omit<
            SvgPrimitiveProps<BackgroundState, SVGSVGElement>,
            "children" | "offset"
        > {
        /** the marks: `dots` (default), `lines` or `cross` */
        variant?: BackgroundVariant | undefined;
        /** the distance between two marks, in flow units; default 20 (`[x, y]` for two) */
        gap?: number | readonly [number, number] | undefined;
        /** dots: a dot's diameter (flow units); lines: the stroke width (screen pixels); cross: a bar's length */
        size?: number | undefined;
        /** the pattern's shift from the flow's origin, in flow units */
        offset?: number | readonly [number, number] | undefined;
    }

    const BACKGROUND_STYLE = {
        position: "absolute",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        "pointer-events": "none",
    };

    const EMPTY_PATTERN: BackgroundPattern = Object.freeze({
        variant: "dots",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        dot: undefined,
        path: undefined,
        strokeWidth: 0,
    });
</script>

<!--
    @component
    The flow's background (`data-flow-part="background"`): an SVG pattern of dots, lines or crosses
    that pans and zooms with the viewport (`background-pattern`), inside `Flow.Root` before
    `Flow.Viewport`. The marks are drawn in `currentColor`: set the `color` (and the background
    itself) in your style.
-->
<script lang="ts">
    import { partAttributes } from "@fragiola/flow";
    import { useFlowContext } from "../context.js";
    import { flowValue } from "../runes/internal.svelte.js";
    import {
        elementProps,
        refProps,
        type RenderedProps,
    } from "../utils/render.js";

    let {
        variant,
        gap,
        size,
        offset,
        render,
        class: className,
        style,
        ref = $bindable(),
        ...rest
    }: BackgroundProps = $props();

    const context = useFlowContext("Background");
    const pattern = flowValue(context, () =>
        context.engine
            ? context.engine.get("background-pattern", {
                  variant,
                  gap,
                  size,
                  offset,
              })
            : undefined,
    );
    const uid = $props.id();
    const id = `flow-background-${uid.replace(/[^a-zA-Z0-9_-]/g, "")}`;
    const refs = refProps((element) => {
        ref = element as SVGSVGElement | null;
    });
    // drawn once the engine is there (a server render has the bare element)
    const partState = $derived<BackgroundState>({
        pattern: pattern.current ?? EMPTY_PATTERN,
    });
    const attrs: RenderedProps<SVGSVGElement> = $derived(
        elementProps({
            rest,
            className,
            style,
            state: partState,
            own: { ...partAttributes("background"), ...refs },
            structural: BACKGROUND_STYLE,
        }),
    );
</script>

{#snippet content()}
    {#if pattern.current}
        {@const tile = pattern.current}
        <pattern
            data-flow-part="background-pattern"
            {id}
            patternUnits="userSpaceOnUse"
            x={tile.x}
            y={tile.y}
            width={tile.width}
            height={tile.height}
        >
            {#if tile.dot}
                <circle
                    data-flow-part="background-mark"
                    cx={tile.dot.cx}
                    cy={tile.dot.cy}
                    r={tile.dot.r}
                    fill="currentColor"
                />
            {:else}
                <path
                    data-flow-part="background-mark"
                    d={tile.path}
                    fill="none"
                    stroke="currentColor"
                    stroke-width={tile.strokeWidth}
                />
            {/if}
        </pattern>
        <rect
            data-flow-part="background-fill"
            width="100%"
            height="100%"
            fill={`url(#${id})`}
        />
    {/if}
{/snippet}

{#if render}
    {@render render({ props: attrs as never, state: partState, children: content })}
{:else}
    <svg {...attrs}>{@render content()}</svg>
{/if}
