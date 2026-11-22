<script module lang="ts">
    import type { FlowEdgeInput, FlowNodeInput, FlowTypes } from "@fragiola/flow-svelte";
    import { drag } from "@fragiola/flow-svelte/drag";
    import { selection } from "@fragiola/flow-svelte/selection";

    // The edge's `type` picks its path: the core draws `bezier` (the default), `simplebezier` (one
    // curve, its control points halfway on each end's axis), `smoothstep`, `step` and `straight`.
    // Any other type is the app's: `Flow.EdgePath` takes a `d` of your own, drawn here from the
    // edge's ends (`useEdge(edge).state.path`) as a wave (wave-edge.svelte). Drag the nodes to see
    // each path follow.

    export interface Types extends FlowTypes {
        readonly nodes: { point: { label: string } };
        readonly edges: { wave: { amplitude: number } };
    }

    export const features = [selection(), drag()] as const;

    const TYPES = ["bezier", "simplebezier", "smoothstep", "step", "straight", "wave"] as const;

    const nodes: FlowNodeInput<Types>[] = TYPES.flatMap((type, index) => [
        {
            id: `${type}-a`,
            type: "point",
            position: { x: index * 170, y: 0 },
            data: { label: "Source" },
        },
        {
            id: `${type}-b`,
            type: "point",
            position: { x: index * 170 + 60, y: 200 },
            data: { label: "Target" },
        },
    ]);

    const edges: FlowEdgeInput<Types>[] = TYPES.map((type) =>
        type === "wave"
            ? {
                  id: type,
                  source: `${type}-a`,
                  target: `${type}-b`,
                  type,
                  data: { amplitude: 10 },
              }
            : { id: type, source: `${type}-a`, target: `${type}-b`, type },
    );
</script>

<script lang="ts">
    import { typedFlow } from "@fragiola/flow-svelte";
    import { styles } from "./styles";
    import WaveEdge from "./wave-edge.svelte";

    const Flow = typedFlow<Types, typeof features>();
</script>

<Flow.Root
    {features}
    defaultNodes={nodes}
    defaultEdges={edges}
    fitView={{ padding: 0.15 }}
    class={styles.root}
>
    <Flow.Background variant="dots" size={2} class={styles.dots} />
    <Flow.Background variant="lines" class={styles.lines} />
    <Flow.Background variant="cross" class={styles.cross} />
    <Flow.Viewport>
        <Flow.Edges>
            {#snippet children(edge)}
                {#if edge.type === "wave"}
                    <WaveEdge {edge} />
                {:else}
                    <Flow.Edge {edge}>
                        <Flow.EdgePath class={styles.edge} />
                        <Flow.EdgeLabel class={styles.label}>
                            {edge.type ?? "bezier"}
                        </Flow.EdgeLabel>
                    </Flow.Edge>
                {/if}
            {/snippet}
        </Flow.Edges>
        <Flow.Nodes>
            {#snippet children(node)}
                <Flow.Node {node} class={styles.node}>
                    {node.data.label}
                    <Flow.Handle type="target" side="top" class={styles.handle} />
                    <Flow.Handle type="source" side="bottom" class={styles.handle} />
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
    </Flow.Viewport>
</Flow.Root>
