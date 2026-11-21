<!--
    A flow drawn with the core's primitives (Vue's `TestFlow`): its props go to `Flow.Root`, its
    children inside the root, after the viewport.
-->
<script lang="ts">
    import type { Snippet } from "svelte";
    import { Flow, type RootProps } from "../../src/index.js";

    let {
        label = false,
        extra,
        nodes = $bindable(),
        edges = $bindable(),
        viewport = $bindable(),
        ...rest
    }: RootProps & { label?: boolean; extra?: Snippet } = $props();
</script>

<Flow.Root bind:nodes bind:edges bind:viewport {...rest}>
    <Flow.Background />
    <Flow.Viewport>
        <Flow.Edges>
            {#snippet children(edge)}
                <Flow.Edge {edge}>
                    <Flow.EdgePath />
                    {#if label}
                        <Flow.EdgeLabel>{edge.id}</Flow.EdgeLabel>
                    {/if}
                </Flow.Edge>
            {/snippet}
        </Flow.Edges>
        <Flow.Nodes>
            {#snippet children(node)}
                <Flow.Node {node}>
                    <Flow.Handle type="target" side="top" />
                    <Flow.Handle type="source" side="bottom" />
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
        <Flow.ConnectionLine />
    </Flow.Viewport>
    <Flow.SelectionBox />
    {@render extra?.()}
</Flow.Root>
