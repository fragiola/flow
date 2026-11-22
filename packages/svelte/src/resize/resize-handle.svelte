<script module lang="ts">
    import type { Snippet } from "svelte";
    import type { DivPrimitiveProps } from "../utils/render.js";

    /** A corner or a side of a node a `ResizeHandle` moves. */
    export type ResizePosition =
        | "top-left"
        | "top"
        | "top-right"
        | "right"
        | "bottom-right"
        | "bottom"
        | "bottom-left"
        | "left";

    /** Every position, corners then sides. */
    export const RESIZE_POSITIONS: readonly ResizePosition[] = Object.freeze([
        "top-left",
        "top-right",
        "bottom-right",
        "bottom-left",
        "top",
        "right",
        "bottom",
        "left",
    ]);

    export interface ResizeHandleState {
        readonly nodeId: string;
        readonly position: ResizePosition;
    }

    export interface ResizeHandleProps
        extends Omit<DivPrimitiveProps<ResizeHandleState>, "children"> {
        /** the corner or side it moves */
        position: ResizePosition;
        /** its node; default the enclosing `Flow.Node`'s */
        nodeId?: string | undefined;
        children?: Snippet<[{ state: ResizeHandleState }]> | undefined;
    }

    /**
     * Where a handle sits: a corner's centre on the corner, a side's along the side. A corner is
     * above the two sides it joins (`z-index`), so a press on it resizes both dimensions, whatever
     * the order of the handles.
     */
    const PLACE: Record<ResizePosition, Record<string, string>> = {
        "top-left": {
            top: "0",
            left: "0",
            transform: "translate(-50%, -50%)",
            "z-index": "1",
        },
        "top-right": {
            top: "0",
            left: "100%",
            transform: "translate(-50%, -50%)",
            "z-index": "1",
        },
        "bottom-right": {
            top: "100%",
            left: "100%",
            transform: "translate(-50%, -50%)",
            "z-index": "1",
        },
        "bottom-left": {
            top: "100%",
            left: "0",
            transform: "translate(-50%, -50%)",
            "z-index": "1",
        },
        top: { top: "0", left: "0", width: "100%", transform: "translateY(-50%)" },
        bottom: {
            top: "100%",
            left: "0",
            width: "100%",
            transform: "translateY(-50%)",
        },
        left: {
            top: "0",
            left: "0",
            height: "100%",
            transform: "translateX(-50%)",
        },
        right: {
            top: "0",
            left: "100%",
            height: "100%",
            transform: "translateX(-50%)",
        },
    };
</script>

<!--
    @component
    A grab area of a `NodeResizer` (`data-flow-part="resize-handle"`, `data-position`): a press on
    it resizes its node from that corner or side (`resize()`); with `keyboard()` too it takes focus
    and the arrows move that corner or side. Placed on its corner (centred) or along its side; give
    it its size (a side's thickness) and look.
-->
<script lang="ts">
    import { partAttributes } from "@fragiola/flow";
    import { useFlowContext, usePartNodeId } from "../context.js";
    import { flowValue } from "../runes/internal.svelte.js";
    import {
        elementProps,
        refProps,
        type RenderedProps,
    } from "../utils/render.js";

    let {
        position,
        nodeId: nodeIdProp,
        children,
        render,
        class: className,
        style,
        ref = $bindable(),
        ...rest
    }: ResizeHandleProps = $props();

    const nodeIdOf = usePartNodeId("ResizeHandle", () => nodeIdProp);
    const context = useFlowContext("ResizeHandle");
    // the engine's record: `data-position`, and `tabindex` with `keyboard()` (arrows resize)
    const attributes = flowValue(context, () =>
        context.engine
            ? context.engine.adapter.attributes("resize-handle", {
                  nodeId: nodeIdOf(),
                  position,
              })
            : { ...partAttributes("resize-handle"), "data-position": position },
    );
    const refs = refProps((element) => {
        ref = element as HTMLDivElement | null;
    });
    const partState = $derived<ResizeHandleState>({ nodeId: nodeIdOf(), position });
    const attrs: RenderedProps<HTMLDivElement> = $derived(
        elementProps({
            rest,
            className,
            style,
            state: partState,
            own: { ...attributes.current, ...refs },
            structural: {
                position: "absolute",
                "pointer-events": "auto",
                ...PLACE[position],
            },
        }),
    );
</script>

{#snippet content()}{@render children?.({ state: partState })}{/snippet}

{#if render}
    {@render render({ props: attrs as never, state: partState, children: content })}
{:else}
    <div {...attrs}>{@render content()}</div>
{/if}
