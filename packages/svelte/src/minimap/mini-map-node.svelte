<script module lang="ts">
    import type { SvgPrimitiveProps } from "../utils/render.js";

    export interface MiniMapNodeState {
        readonly nodeId: string;
        /** `data-selected` (`selection()`) */
        readonly selected: boolean;
    }

    export interface MiniMapNodeProps
        extends Omit<
            SvgPrimitiveProps<MiniMapNodeState, SVGRectElement>,
            "children"
        > {
        /** the node it stands for */
        nodeId: string;
    }
</script>

<!--
    @component
    A node in the `MiniMap` (`data-flow-part="minimap-node"`, `data-flow-id`): an SVG rectangle of
    the node's box, in flow coordinates. Nothing when the node is not shown.
-->
<script lang="ts">
    import { partAttributes } from "@fragiola/flow";
    import { useFlowContext } from "../context.js";
    import { flowValue, sameValue } from "../runes/internal.svelte.js";
    import {
        elementProps,
        refProps,
        type RenderedProps,
    } from "../utils/render.js";
    import { useMiniMapContext } from "./mini-map-context.js";

    let {
        nodeId,
        render,
        class: className,
        style,
        ref = $bindable(),
        ...rest
    }: MiniMapNodeProps = $props();

    const map = useMiniMapContext("MiniMapNode");
    const context = useFlowContext("MiniMapNode");
    const attributes = flowValue(context, () =>
        context.engine
            ? context.engine.adapter.attributes("minimap-node", { nodeId })
            : partAttributes("minimap-node", nodeId),
        sameValue,
        { scope: "entity" },
    );
    const refs = refProps((element) => {
        ref = element as SVGRectElement | null;
    });
    const box = $derived(map.view.nodes.find((node) => node.nodeId === nodeId));
    const partState = $derived<MiniMapNodeState>({
        nodeId,
        selected: attributes.current["data-selected"] !== undefined,
    });
    const attrs: RenderedProps<SVGRectElement> = $derived(
        elementProps({
            rest,
            className,
            style,
            state: partState,
            own: {
                ...attributes.current,
                x: box?.x,
                y: box?.y,
                width: box?.width,
                height: box?.height,
                ...refs,
            },
        }),
    );
</script>

{#snippet content()}{/snippet}

{#if box}
    {#if render}
        {@render render({ props: attrs as never, state: partState, children: content })}
    {:else}
        <rect {...attrs} />
    {/if}
{/if}
