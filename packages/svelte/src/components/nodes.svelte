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

    // its own stacking context with one render level: the nodes' z-index (a selected one raised)
    // orders them among themselves, never above what follows the layer (the connection line).
    // With several, none: the nodes' (negative) z-indexes interleave with the edges' level wrappers
    const NODES_STYLE = {
        position: "absolute",
        top: "0",
        left: "0",
        isolation: "isolate",
    };
    const LAYERED_NODES_STYLE = { position: "absolute", top: "0", left: "0" };
    const NO_NODES: readonly FlowNode[] = Object.freeze([]);
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
        // a culled flow renders no node before the engine (the server render, the first client
        // render): it knows no size to cull by, and every node mounted once costs the open
        if (!engine && context.onlyRenderVisible) return NO_NODES as never;
        return (
            engine?.adapter.settings.onlyRenderVisible
                ? engine.get("visible-nodes")
                : model.get("all-nodes").filter((node) => node.hidden !== true)
        ) as readonly FlowNode<T>[];
    });
    // several render levels (an edge above some node): the engine's, or the static geometry's
    const layered = flowValue(context, () => {
        const { engine, geometry } = context;
        return (
            (engine
                ? engine.get("render-layers").length
                : (geometry?.layers.length ?? 1)) > 1
        );
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
            structural: layered.current ? LAYERED_NODES_STYLE : NODES_STYLE,
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
