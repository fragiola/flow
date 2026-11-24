<!--
    A flow whose nodes, edges and edge paths count their renders (`seen("node a")`, `"edge ab"`,
    `"path ab"`: each time their part's state is a new object), with handles on each node; its
    other props go to `Flow.Root`.
-->
<script lang="ts">
    import { Flow, type FlowEdge, type FlowNode, type RootProps } from "../../src/index.js";
    import RenderProbe from "./render-probe.svelte";

    let {
        seen,
        ...rest
    }: RootProps & { seen?: ((id: string) => void) | undefined } = $props();
</script>

{#snippet edge(entity: FlowEdge)}
    <Flow.Edge edge={entity}>
        {#snippet children({ state })}
            <RenderProbe id={`edge ${entity.id}`} value={state} {seen} />
            <Flow.EdgePath>
                {#snippet children({ state: path })}
                    <RenderProbe id={`path ${entity.id}`} value={path} {seen} />
                {/snippet}
            </Flow.EdgePath>
        {/snippet}
    </Flow.Edge>
{/snippet}

{#snippet node(entity: FlowNode)}
    <Flow.Node node={entity}>
        {#snippet children({ state })}
            <RenderProbe id={`node ${entity.id}`} value={state} {seen} />
            <Flow.Handle type="target" side="top" />
            <Flow.Handle type="source" side="bottom" />
        {/snippet}
    </Flow.Node>
{/snippet}

<Flow.Root {...rest}>
    <Flow.Viewport>
        <Flow.Edges children={edge} />
        <Flow.Nodes children={node} />
    </Flow.Viewport>
</Flow.Root>
