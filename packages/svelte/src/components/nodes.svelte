<script module lang="ts">
    import type { AnyTypes, FlowNode, FlowTypes } from "@fragiola/flow";
    import type { Snippet } from "svelte";
    import type { DivPrimitiveProps } from "../utils/render.js";

    export interface NodesState {
        /** how many nodes are rendered */
        count: number;
    }

    export interface NodesProps<T extends FlowTypes = AnyTypes>
        extends Omit<DivPrimitiveProps<NodesState>, "children"> {
        /**
         * renders one node (`{#snippet children(node)}`): usually a `Flow.Node` with its content
         * and handles. Each node renders again when its node changes (the model shares the nodes
         * a command did not change), or when a value the snippet reads does
         */
        children: Snippet<[FlowNode<T>]>;
    }

    // its own stacking context: the nodes' z-index (a selected one raised) orders them among
    // themselves, never above what follows the layer (the connection line)
    const NODES_STYLE = {
        position: "absolute",
        top: "0",
        left: "0",
        isolation: "isolate",
    };
</script>

<!--
    @component
    The layer of the nodes (`data-flow-part="nodes"`), inside `Flow.Viewport`: calls its children
    snippet for each node that is not hidden (with `onlyRenderVisible`, each one in view,
    `visible-nodes`), in drawing order, keyed by its id (a node keeps its element when it moves).
    You render each node.
-->
<script lang="ts" generics="T extends FlowTypes = AnyTypes">
    import { partAttributes } from "@fragiola/flow";
    import { useFlowContext } from "../context.js";
    import { flowValue } from "../runes/internal.svelte.js";
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
    }: NodesProps<T> = $props();

    const context = useFlowContext("Nodes");
    const list = flowValue(context, () => {
        const { engine, model } = context;
        return (
            engine?.adapter.settings.onlyRenderVisible
                ? engine.get("visible-nodes")
                : model.get("all-nodes").filter((node) => node.hidden !== true)
        ) as readonly FlowNode<T>[];
    });
    const refs = refProps((element) => {
        ref = element as HTMLDivElement | null;
    });
    const own = { ...partAttributes("nodes"), ...refs };
    const partState = $derived<NodesState>({ count: list.current.length });
    const attrs: RenderedProps<HTMLDivElement> = $derived(
        elementProps({
            rest,
            className,
            style,
            state: partState,
            own,
            structural: NODES_STYLE,
        }),
    );
</script>

{#snippet content()}
    {#each list.current as node (node.id)}
        {@render children(node)}
    {/each}
{/snippet}

{#if render}
    {@render render({ props: attrs as never, state: partState, children: content })}
{:else}
    <div {...attrs}>{@render content()}</div>
{/if}
