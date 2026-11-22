<script module lang="ts">
    import type {
        FlowEdgeInput,
        FlowNode,
        FlowNodeInput,
        FlowTypes,
    } from "@fragiola/flow-svelte";
    import { connection } from "@fragiola/flow-svelte/connection";
    import { drag } from "@fragiola/flow-svelte/drag";
    import { selection } from "@fragiola/flow-svelte/selection";

    // A node that computes from its inputs: the sum node reads the connections that end at it
    // (`useNodeConnections`) and their source nodes' data (`useNodesData`), so it follows a value
    // changed with the steppers and an edge connected or removed, and updates only then (a drag of
    // another node does not touch it). Connect the third number to the sum to add it.

    export interface Types extends FlowTypes {
        readonly nodes: {
            number: { label: string; value: number };
            sum: { label: string };
        };
    }

    export type Node = FlowNode<Types>;

    export const features = [selection(), drag(), connection()] as const;

    const nodes: FlowNodeInput<Types>[] = [
        {
            id: "a",
            type: "number",
            position: { x: 0, y: 0 },
            data: { label: "A", value: 3 },
        },
        {
            id: "b",
            type: "number",
            position: { x: 0, y: 130 },
            data: { label: "B", value: 5 },
        },
        {
            id: "c",
            type: "number",
            position: { x: 0, y: 260 },
            data: { label: "C", value: 8 },
        },
        {
            id: "sum",
            type: "sum",
            position: { x: 300, y: 110 },
            data: { label: "Sum" },
        },
    ];

    const edges: FlowEdgeInput<Types>[] = [
        { id: "a-sum", source: "a", target: "sum" },
        { id: "b-sum", source: "b", target: "sum" },
    ];
</script>

<script lang="ts">
    import { typedFlow } from "@fragiola/flow-svelte";
    import NumberBody from "./number-body.svelte";
    import { styles } from "./styles";
    import SumBody from "./sum-body.svelte";

    const Flow = typedFlow<Types, typeof features>();
</script>

<Flow.Root
    {features}
    defaultNodes={nodes}
    defaultEdges={edges}
    fitView={{ padding: 0.2, maxZoom: 1 }}
    role="group"
    aria-label="A sum of numbers"
    class={styles.root}
>
    <Flow.Background variant="dots" size={2} class={styles.dots} />
    <Flow.Background variant="lines" class={styles.lines} />
    <Flow.Background variant="cross" class={styles.cross} />
    <Flow.Viewport>
        <Flow.Edges>
            {#snippet children(edge)}
                <Flow.Edge {edge}>
                    <Flow.EdgePath class={styles.edge} />
                </Flow.Edge>
            {/snippet}
        </Flow.Edges>
        <Flow.Nodes>
            {#snippet children(node)}
                <Flow.Node
                    {node}
                    role="group"
                    aria-roledescription="node"
                    aria-label={node.data.label}
                    class={styles.node}
                >
                    {#if node.type === "number"}
                        <NumberBody {node} />
                        <Flow.Handle
                            type="source"
                            side="right"
                            aria-label="{node.data.label} output"
                            class={styles.handle}
                        />
                    {:else}
                        <SumBody />
                        <Flow.Handle
                            type="target"
                            side="left"
                            aria-label="Sum input"
                            class={styles.handle}
                        />
                    {/if}
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
        <Flow.ConnectionLine class={styles.connection} />
    </Flow.Viewport>
    <p class={styles.hint}>Change a number, or connect C to the sum</p>
</Flow.Root>
