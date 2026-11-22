<!--
    A flow whose probes read #36's runes: `outside` (probes inside the root, outside the viewport),
    `inside` (probes in each node, given the node's id: `undefined` renders none there), `watch`
    (called in a component inside the root, for a rune that returns nothing). Its other props go to
    `Flow.Root`.
-->
<script lang="ts">
    import { Flow, type FlowValue, type RootProps } from "../../src/index.js";
    import HooksProbe from "./hooks-probe.svelte";
    import HooksWatch from "./hooks-watch.svelte";

    let {
        outside = [],
        inside,
        watch,
        seen,
        ...rest
    }: RootProps & {
        outside?: (() => FlowValue<unknown>)[];
        inside?: ((nodeId: string) => (() => FlowValue<unknown>) | undefined) | undefined;
        watch?: (() => void) | undefined;
        seen: unknown[][];
    } = $props();
</script>

<Flow.Root {...rest}>
    <Flow.Viewport>
        <Flow.Edges>
            {#snippet children(edge)}
                <Flow.Edge {edge}><Flow.EdgePath /></Flow.Edge>
            {/snippet}
        </Flow.Edges>
        <Flow.Nodes>
            {#snippet children(node)}
                <Flow.Node {node}>
                    <Flow.Handle type="target" side="top" />
                    <Flow.Handle type="source" side="bottom" />
                    {@const use = inside?.(node.id)}
                    {#if use}
                        <HooksProbe {use} seen={seen[0] as unknown[]} />
                    {/if}
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
    </Flow.Viewport>
    {#each outside as use, i (i)}
        <HooksProbe {use} seen={seen[i] as unknown[]} />
    {/each}
    {#if watch}
        <HooksWatch {watch} />
    {/if}
</Flow.Root>
