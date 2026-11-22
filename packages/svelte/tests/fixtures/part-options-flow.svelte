<!--
    #36's parts and their new props: its props go to `Flow.Root`; `minimap` (given: a `MiniMap`
    with them), `minimaps` (a `MiniMap` for each), `resizer` (a `NodeResizer` in every node with them), `fitView` (a `FitView`,
    test id `fit`), `edgeToolbar` (an `EdgeToolbar` on every edge, test id `toolbar`),
    `nodesSelection` (a `Flow.NodesSelection` after the nodes, test id `rect`); #40: `handles` (the
    resizer's own `ResizeHandle`s, with these props).
-->
<script lang="ts">
    import { Flow, type EdgeToolbarProps, type FitViewProps, type RootProps } from "../../src/index.js";
    import { MiniMap, type MiniMapProps } from "../../src/minimap/index.js";
    import {
        NodeResizer,
        type NodeResizerProps,
        ResizeHandle,
        type ResizeHandleProps,
    } from "../../src/resize/index.js";

    let {
        minimap,
        minimaps = [],
        resizer,
        fitView,
        edgeToolbar,
        nodesSelection = false,
        handles,
        ...rest
    }: RootProps & {
        minimap?: MiniMapProps | undefined;
        minimaps?: readonly MiniMapProps[];
        resizer?: NodeResizerProps | undefined;
        fitView?: FitViewProps | undefined;
        edgeToolbar?: EdgeToolbarProps | undefined;
        nodesSelection?: boolean;
        handles?: readonly ResizeHandleProps[] | undefined;
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
                    {#if resizer && handles}
                        <NodeResizer {...resizer}>
                            {#each handles as handle (handle.position)}
                                <ResizeHandle {...handle} />
                            {/each}
                        </NodeResizer>
                    {:else if resizer}
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
    {#each minimaps as each, i (i)}
        <MiniMap {...each} />
    {/each}
</Flow.Root>
