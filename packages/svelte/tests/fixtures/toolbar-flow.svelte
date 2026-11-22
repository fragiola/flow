<!-- #28: nodes `a` (0, 0) and `b` (0, 200), an edge `ab` with a toolbar, a toolbar over `nodeIds`. -->
<script lang="ts">
    import { selection } from "@fragiola/flow/selection";
    import {
        Flow,
        type FlowEdge,
        type FlowNode,
        type RootProps,
    } from "../../src/index.js";
    import type { EdgeToolbarProps } from "../../src/components/edge-toolbar.svelte";

    let {
        edgeToolbar = {},
        nodeIds,
        ...rest
    }: RootProps & {
        edgeToolbar?: Partial<EdgeToolbarProps>;
        nodeIds?: readonly string[];
    } = $props();
</script>

<Flow.Root
    features={[selection()]}
    defaultNodes={[
        { id: "a", type: "task", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
        { id: "b", type: "task", position: { x: 0, y: 200 }, data: {}, width: 100, height: 40 },
    ]}
    defaultEdges={[{ id: "ab", source: "a", target: "b" }]}
    {...rest}
>
    <Flow.Viewport>
        <Flow.Edges>
            {#snippet children(edge: FlowEdge)}
                <Flow.Edge {edge}>
                    <Flow.EdgePath />
                    <Flow.EdgeToolbar data-testid="edge-toolbar" {...edgeToolbar}>
                        <button type="button">x</button>
                    </Flow.EdgeToolbar>
                </Flow.Edge>
            {/snippet}
        </Flow.Edges>
        <Flow.Nodes>
            {#snippet children(node: FlowNode)}
                <Flow.Node {node}>
                    <Flow.Handle type="target" side="top" />
                    <Flow.Handle type="source" side="bottom" />
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
    </Flow.Viewport>
    {#if nodeIds}
        <Flow.NodeToolbar data-testid="nodes-toolbar" {nodeIds} />
    {/if}
</Flow.Root>
