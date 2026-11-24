<script module lang="ts">
    import type { ResizeDirection } from "@fragiola/flow/resize";
    import type { Snippet } from "svelte";
    import type { DivPrimitiveProps } from "../utils/render.js";

    export interface NodeResizerState {
        readonly nodeId: string;
        /** its node is being resized: `data-resizing` */
        readonly resizing: boolean;
    }

    export interface NodeResizerProps
        extends Omit<DivPrimitiveProps<NodeResizerState>, "children"> {
        /** its node; default the enclosing `Flow.Node`'s */
        nodeId?: string | undefined;
        /** this node's limits, over `resize()`'s (in flow units) */
        minWidth?: number | undefined;
        minHeight?: number | undefined;
        maxWidth?: number | undefined;
        maxHeight?: number | undefined;
        /** this node keeps its aspect ratio, over `resize()`'s */
        keepAspectRatio?: boolean | undefined;
        /**
         * the sides its handles move: `"horizontal"` only the width (and x), `"vertical"` only the
         * height (and y); default both. A corner then moves its one dimension
         */
        direction?: ResizeDirection | undefined;
        /** its handles; default a `ResizeHandle` at each corner and side */
        children?: Snippet<[{ state: NodeResizerState }]> | undefined;
    }

    const RESIZER_STYLE = {
        position: "absolute",
        inset: "0",
        "pointer-events": "none",
    };
</script>

<!--
    @component
    A node's resizer (`data-flow-part="resizer"`, `resize()`), inside `Flow.Node`: a box over the
    node holding its `ResizeHandle`s; its limits are this node's own (`setPartOptions`). Render it
    only when the node should be resizable (while it is selected, say).
-->
<script lang="ts">
    import { useFlowContext, usePartNodeId } from "../context.js";
    import { flowValue, sameValue } from "../runes/internal.svelte.js";
    import {
        elementProps,
        refProps,
        type RenderedProps,
    } from "../utils/render.js";
    import ResizeHandle, { RESIZE_POSITIONS } from "./resize-handle.svelte";

    let {
        nodeId: nodeIdProp,
        minWidth,
        minHeight,
        maxWidth,
        maxHeight,
        keepAspectRatio,
        direction,
        children,
        render,
        class: className,
        style,
        ref = $bindable(),
        ...rest
    }: NodeResizerProps = $props();

    const nodeIdOf = usePartNodeId("NodeResizer", () => nodeIdProp);
    const nodeId = $derived(nodeIdOf());
    const context = useFlowContext("NodeResizer");
    // this node's limits, on the engine while it is there
    $effect(() => {
        const engine = context.engine;
        const id = nodeId;
        const options = Object.fromEntries(
            Object.entries({
                minWidth,
                minHeight,
                maxWidth,
                maxHeight,
                keepAspectRatio,
                direction,
            }).filter(([, value]) => value !== undefined),
        );
        if (!engine) return;
        engine.adapter.setPartOptions("resizer", id, options);
        return () => engine.adapter.setPartOptions("resizer", id, null);
    });
    const attributes = flowValue(
        context,
        () =>
            context.engine
                ? context.engine.adapter.attributes("resizer", { nodeId })
                : { "data-flow-part": "resizer", "data-flow-id": nodeId },
        sameValue,
        { scope: "entity" },
    );
    const refs = refProps((element) => {
        ref = element as HTMLDivElement | null;
    });
    const partState = $derived<NodeResizerState>({
        nodeId,
        resizing: attributes.current["data-resizing"] !== undefined,
    });
    const attrs: RenderedProps<HTMLDivElement> = $derived(
        elementProps({
            rest,
            className,
            style,
            state: partState,
            own: { ...attributes.current, ...refs },
            structural: RESIZER_STYLE,
        }),
    );
</script>

{#snippet content()}
    {#if children}
        {@render children({ state: partState })}
    {:else}
        {#each RESIZE_POSITIONS as position (position)}
            <ResizeHandle {position} nodeId={partState.nodeId} />
        {/each}
    {/if}
{/snippet}

{#if render}
    {@render render({ props: attrs as never, state: partState, children: content })}
{:else}
    <div {...attrs}>{@render content()}</div>
{/if}
