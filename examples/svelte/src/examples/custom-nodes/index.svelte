<script module lang="ts">
    import type { FlowEdgeInput, FlowNode, FlowNodeInput, FlowTypes } from "@fragiola/flow-svelte";
    import { connection } from "@fragiola/flow-svelte/connection";
    import { drag } from "@fragiola/flow-svelte/drag";
    import { selection } from "@fragiola/flow-svelte/selection";

    // Each node type renders its own content from its typed data. The `Types` registry names the
    // node types and their data, so `node.type` narrows `node.data`. The colour and number nodes
    // write their data with `node.set-data`; the preview reads the nodes wired into its two target
    // handles. A field inside a node keeps its own presses: it never starts a drag. The preview
    // drags only by its title bar: an element with `data-flow-drag-handle` makes the rest of its
    // node a press that selects it and moves nothing. Each node type is a component of its own
    // (colour-node.svelte, number-node.svelte, preview-node.svelte).

    export interface Types extends FlowTypes {
        readonly nodes: {
            colour: { label: string; colour: string };
            number: { label: string; value: number };
            preview: { label: string };
        };
    }

    export type Node = FlowNode<Types>;

    export const features = [selection(), drag(), connection()] as const;

    const nodes: FlowNodeInput<Types>[] = [
        {
            id: "colour",
            type: "colour",
            position: { x: 0, y: 0 },
            data: { label: "Colour", colour: "#3b82f6" },
        },
        {
            id: "size",
            type: "number",
            position: { x: 0, y: 160 },
            data: { label: "Size", value: 48 },
        },
        {
            id: "preview",
            type: "preview",
            position: { x: 320, y: 50 },
            data: { label: "Preview" },
        },
    ];

    const edges: FlowEdgeInput<Types>[] = [
        {
            id: "colour-preview",
            source: "colour",
            target: "preview",
            targetHandle: "colour",
        },
        {
            id: "size-preview",
            source: "size",
            target: "preview",
            targetHandle: "size",
        },
    ];
</script>

<script lang="ts">
    import { typedFlow } from "@fragiola/flow-svelte";
    import ColourNode from "./colour-node.svelte";
    import NumberNode from "./number-node.svelte";
    import PreviewNode from "./preview-node.svelte";
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
                <Flow.Edge {edge}>
                    <Flow.EdgePath class={styles.edge} />
                </Flow.Edge>
            {/snippet}
        </Flow.Edges>
        <Flow.Nodes>
            {#snippet children(node)}
                <Flow.Node {node} class={styles.node}>
                    {#if node.type === "colour"}
                        <ColourNode {node} />
                    {:else if node.type === "number"}
                        <NumberNode {node} />
                    {:else if node.type === "preview"}
                        <PreviewNode {node} />
                    {/if}
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
        <Flow.ConnectionLine class={styles.connection} />
    </Flow.Viewport>
</Flow.Root>
