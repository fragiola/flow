<!-- Nodes rendered by hand (`useNode`), a toolbar per node, and a flow ref. -->
<script lang="ts">
    import { Flow, type FlowNode, type RootProps } from "../../src/index.js";
    import HandNode from "./hand-node.svelte";

    let { hand = false, ...rest }: RootProps & { hand?: boolean } = $props();
</script>

<Flow.Root {...rest}>
    <Flow.Viewport>
        <Flow.Nodes>
            {#snippet children(node: FlowNode)}
                {#if hand}
                    <HandNode {node} />
                {:else}
                    <Flow.Node {node}>
                        <Flow.NodeToolbar data-testid="toolbar" />
                    </Flow.Node>
                {/if}
            {/snippet}
        </Flow.Nodes>
    </Flow.Viewport>
</Flow.Root>
