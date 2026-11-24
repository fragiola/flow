<!--
    A flow whose edge paths render an `<animate>` in their `children` snippet, given their state
    (React's `Flow.EdgePath` children).
-->
<script lang="ts">
    import { Flow, type RootProps } from "../../src/index.js";

    let { ...rest }: RootProps = $props();
</script>

<Flow.Root {...rest}>
    <Flow.Viewport>
        <Flow.Edges>
            {#snippet children(edge)}
                <Flow.Edge {edge}>
                    <Flow.EdgePath>
                        {#snippet children({ state })}
                            <animate
                                attributeName="stroke-dashoffset"
                                data-edge={state.edgeId}
                            />
                        {/snippet}
                    </Flow.EdgePath>
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
    </Flow.Viewport>
</Flow.Root>
