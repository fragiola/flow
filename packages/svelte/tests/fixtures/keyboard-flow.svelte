<!-- #28: handles and resize handles, with the features the test gives. -->
<script lang="ts">
    import {
        Flow,
        type FlowEdge,
        type FlowNode,
        type RootProps,
    } from "../../src/index.js";
    import { NodeResizer } from "../../src/resize/index.js";

    let { ...rest }: RootProps = $props();
</script>

<Flow.Root
    defaultNodes={[
        { id: "a", type: "task", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
        { id: "b", type: "task", position: { x: 0, y: 200 }, data: {}, width: 100, height: 40 },
    ]}
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
                    <Flow.Handle type="target" side="top" />
                    <Flow.Handle type="source" side="bottom" />
                    <NodeResizer />
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
        <Flow.ConnectionLine />
    </Flow.Viewport>
</Flow.Root>
