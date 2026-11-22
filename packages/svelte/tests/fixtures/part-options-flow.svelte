<!--
    #36's parts and their new props: its props go to `Flow.Root`; `minimap` (given: a `MiniMap`
    with them), `resizer` (a `NodeResizer` in every node with them), `fitView` (a `FitView`,
    test id `fit`), `edgeToolbar` (an `EdgeToolbar` on every edge, test id `toolbar`),
    `nodesSelection` (a `Flow.NodesSelection` after the nodes, test id `rect`).
-->
<script lang="ts">
    import { Flow, type EdgeToolbarProps, type FitViewProps, type RootProps } from "../../src/index.js";
    import { MiniMap, type MiniMapProps } from "../../src/minimap/index.js";
    import { NodeResizer, type NodeResizerProps } from "../../src/resize/index.js";

    let {
        minimap,
        resizer,
        fitView,
        edgeToolbar,
        nodesSelection = false,
        ...rest
    }: RootProps & {
        minimap?: MiniMapProps | undefined;
        resizer?: NodeResizerProps | undefined;
        fitView?: FitViewProps | undefined;
        edgeToolbar?: EdgeToolbarProps | undefined;
        nodesSelection?: boolean;
    } = $props();
</script>

<Flow.Root {...rest}>
    <Flow.Viewport>
        <Flow.Edges>
            {#snippet children(edge)}
                <Flow.Edge {edge}>
                    <Flow.EdgePath />
                    {#if edgeToolbar}
                        <Flow.EdgeToolbar data-testid="toolbar" {...edgeToolbar} />
                    {/if}
                </Flow.Edge>
            {/snippet}
        </Flow.Edges>
        <Flow.Nodes>
            {#snippet children(node)}
                <Flow.Node {node}>
                    <Flow.Handle type="target" side="top" />
                    <Flow.Handle type="source" side="bottom" />
                    {#if resizer}
                        <NodeResizer {...resizer} />
                    {/if}
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
        {#if nodesSelection}
            <Flow.NodesSelection data-testid="rect" />
        {/if}
    </Flow.Viewport>
    {#if fitView}
        <Flow.FitView data-testid="fit" {...(fitView as FitViewProps)} />
    {/if}
    {#if minimap}
        <MiniMap {...minimap} />
    {/if}
</Flow.Root>
