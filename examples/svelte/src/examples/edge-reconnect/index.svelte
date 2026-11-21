<script module lang="ts">
    import type {
        FlowEdgeInput,
        FlowNodeInput,
        FlowTypes,
    } from "@fragiola/flow-svelte";
    import { connection } from "@fragiola/flow-svelte/connection";
    import { drag } from "@fragiola/flow-svelte/drag";
    import { reconnection } from "@fragiola/flow-svelte/reconnection";
    import { selection } from "@fragiola/flow-svelte/selection";

    // `reconnection()` (it needs `connection()`) lets an edge's end move: press a `Flow.ReconnectAnchor`
    // (drawn here as a ring at each end) or the stroke near an end, and drop it on another handle. The
    // edge keeps its id (`edge.reconnect`); dropped nowhere or on a refused handle, it goes back. The
    // "locked" edge is not reconnectable (`reconnectable: false`).

    interface Types extends FlowTypes {
        readonly nodes: { device: { label: string } };
    }

    const features = [selection(), drag(), connection(), reconnection()] as const;

    const nodes: FlowNodeInput<Types>[] = [
        {
            id: "router",
            type: "device",
            position: { x: 0, y: 100 },
            data: { label: "Router" },
        },
        {
            id: "laptop",
            type: "device",
            position: { x: 300, y: 0 },
            data: { label: "Laptop" },
        },
        {
            id: "printer",
            type: "device",
            position: { x: 300, y: 120 },
            data: { label: "Printer" },
        },
        {
            id: "tv",
            type: "device",
            position: { x: 300, y: 240 },
            data: { label: "TV" },
        },
    ];

    const edges: FlowEdgeInput<Types>[] = [
        { id: "router-laptop", source: "router", target: "laptop" },
        { id: "router-tv", source: "router", target: "tv", reconnectable: false },
    ];
</script>

<script lang="ts">
    import { typedFlow } from "@fragiola/flow-svelte";
    import { styles } from "./styles";

    const Flow = typedFlow<Types, typeof features>();
</script>

<Flow.Root
    {features}
    defaultNodes={nodes}
    defaultEdges={edges}
    fitView={{ padding: 0.2, maxZoom: 1 }}
    class={styles.root}
>
    <Flow.Background variant="dots" size={2} class={styles.dots} />
    <Flow.Background variant="lines" class={styles.lines} />
    <Flow.Background variant="cross" class={styles.cross} />
    <Flow.Viewport>
        <Flow.Edges>
            {#snippet children(edge)}
                <Flow.Edge {edge} class={styles.edgeGroup}>
                    <Flow.EdgePath class={styles.edge} />
                    {#if edge.reconnectable === false}
                        <Flow.EdgeLabel class={styles.label}>locked</Flow.EdgeLabel>
                    {:else}
                        <Flow.ReconnectAnchor end="source" class={styles.anchor} />
                        <Flow.ReconnectAnchor end="target" class={styles.anchor} />
                    {/if}
                </Flow.Edge>
            {/snippet}
        </Flow.Edges>
        <Flow.Nodes>
            {#snippet children(node)}
                <Flow.Node {node} class={styles.node}>
                    {node.data.label}
                    <Flow.Handle type="target" side="left" class={styles.handle} />
                    <Flow.Handle type="source" side="right" class={styles.handle} />
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
        <Flow.ConnectionLine class={styles.connection} />
    </Flow.Viewport>
</Flow.Root>
