<!-- #28's review: toolbars given ids outside their parts, one shown only while `toolbar`, a node
     toolbar of `nodeIds` in each node, and with `orphan` an edge toolbar without an edge. -->
<script lang="ts">
    import { selection } from "@fragiola/flow/selection";
    import {
        Flow,
        type FlowEdge,
        type FlowNode,
        type RootProps,
    } from "../../src/index.js";

    let {
        toolbar = true,
        orphan = false,
        nodeIds,
        ...rest
    }: RootProps & {
        toolbar?: boolean;
        orphan?: boolean;
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
                <Flow.Edge {edge} />
            {/snippet}
        </Flow.Edges>
        <Flow.Nodes>
            {#snippet children(node: FlowNode)}
                <Flow.Node {node}>
                    {#if nodeIds}
                        <Flow.NodeToolbar data-testid="node-toolbar-{node.id}" {nodeIds} />
                    {/if}
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
    </Flow.Viewport>
    {#if toolbar}
        <Flow.EdgeToolbar data-testid="edge-toolbar" edgeId="ab" open />
    {/if}
    {#if orphan}
        <Flow.EdgeToolbar />
    {/if}
</Flow.Root>
