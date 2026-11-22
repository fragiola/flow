<!--
    The flow every contract case renders: every primitive, the one named `target` given `given`
    (attributes, handlers, `class`, `style`, `render`, attachments). Each primitive's element is
    bound to `refs` (`bind:ref`), read by the test through `refOf`.
-->
<script lang="ts">
    import { connection } from "@fragiola/flow/connection";
    import { minimap } from "@fragiola/flow/minimap";
    import { resize } from "@fragiola/flow/resize";
    import { selection } from "@fragiola/flow/selection";
    import { Flow } from "../../src/index.js";
    import { MiniMap, MiniMapMask, MiniMapNode } from "../../src/minimap/index.js";
    import { NodeResizer, ResizeHandle } from "../../src/resize/index.js";
    import { pair } from "../flow.js";

    let {
        target,
        given = {},
    }: { target: string; given?: Record<string | symbol, unknown> } = $props();

    const features = [selection(), connection(), resize(), minimap()] as const;
    const { nodes, edges } = pair();
    const defaultNodes = nodes.map((node) =>
        node.id === "a" ? { ...node, selected: true } : node,
    );

    // the given props fit any primitive
    const at = (name: string): any => (name === target ? given : {});
    const refs: Record<string, Element | null> = $state({});

    /** The element bound to the primitive `name` (the last one, for one rendered per entity). */
    export function refOf(name: string): Element | null {
        return refs[name] ?? null;
    }
</script>

<Flow.Root {features} {defaultNodes} defaultEdges={edges} bind:ref={refs.root} {...at("root")}>
    <Flow.Background bind:ref={refs.background} {...at("background")} />
    <Flow.Viewport bind:ref={refs.viewport} {...at("viewport")}>
        <Flow.Edges bind:ref={refs.edges} {...at("edges")}>
            {#snippet children(edge)}
                <Flow.Edge {edge} bind:ref={refs.edge} {...at("edge")}>
                    <Flow.EdgePath bind:ref={refs["edge-path"]} {...at("edge-path")} />
                    <Flow.EdgeLabel bind:ref={refs["edge-label"]} {...at("edge-label")} />
                    <Flow.ReconnectAnchor
                        end="target"
                        bind:ref={refs["reconnect-anchor"]}
                        {...at("reconnect-anchor")}
                    />
                    <Flow.EdgeToolbar
                        open
                        bind:ref={refs["edge-toolbar"]}
                        {...at("edge-toolbar")}
                    />
                </Flow.Edge>
            {/snippet}
        </Flow.Edges>
        <Flow.Nodes bind:ref={refs.nodes} {...at("nodes")}>
            {#snippet children(node)}
                <Flow.Node {node} bind:ref={refs.node} {...at("node")}>
                    <Flow.Handle
                        type="target"
                        side="top"
                        bind:ref={refs.handle}
                        {...at("handle")}
                    />
                    <Flow.Handle type="source" side="bottom" />
                    {#if node.id === "a"}
                        <NodeResizer bind:ref={refs.resizer} {...at("resizer")}>
                            <ResizeHandle
                                position="bottom-right"
                                bind:ref={refs["resize-handle"]}
                                {...at("resize-handle")}
                            />
                        </NodeResizer>
                        <Flow.NodeToolbar bind:ref={refs.toolbar} {...at("toolbar")} />
                    {/if}
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
        <Flow.ConnectionLine
            bind:ref={refs["connection-line"]}
            {...at("connection-line")}
        />
        <Flow.NodesSelection
            bind:ref={refs["nodes-selection"]}
            {...at("nodes-selection")}
        />
    </Flow.Viewport>
    <Flow.SelectionBox bind:ref={refs["selection-box"]} {...at("selection-box")} />
    <Flow.Controls bind:ref={refs.controls} {...at("controls")}>
        <Flow.ZoomIn bind:ref={refs["zoom-in"]} {...at("zoom-in")} />
        <Flow.ZoomOut bind:ref={refs["zoom-out"]} {...at("zoom-out")} />
        <Flow.FitView bind:ref={refs["fit-view"]} {...at("fit-view")} />
        <Flow.ToggleInteractive
            bind:ref={refs["toggle-interactive"]}
            {...at("toggle-interactive")}
        />
    </Flow.Controls>
    <MiniMap bind:ref={refs.minimap} {...at("minimap")}>
        <MiniMapNode nodeId="a" bind:ref={refs["minimap-node"]} {...at("minimap-node")} />
        <MiniMapMask bind:ref={refs["minimap-mask"]} {...at("minimap-mask")} />
    </MiniMap>
</Flow.Root>
