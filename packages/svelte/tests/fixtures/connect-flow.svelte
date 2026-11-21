<!-- A connectable flow: handles, reconnect anchors, the connection line and its status. -->
<script lang="ts">
    import { Flow, type RootProps } from "../../src/index.js";
    import Status from "./status.svelte";

    let rest: RootProps = $props();
</script>

<Flow.Root {...rest}>
    <Flow.Viewport>
        <Flow.Edges>
            {#snippet children(edge)}
                <Flow.Edge {edge}>
                    <Flow.EdgePath />
                    <Flow.ReconnectAnchor end="target" />
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
    <Status />
</Flow.Root>
