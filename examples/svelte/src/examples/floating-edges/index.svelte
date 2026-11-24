<script module lang="ts">
    import type { FlowEdgeInput, FlowNodeInput, FlowTypes } from "@fragiola/flow-svelte";
    import { drag } from "@fragiola/flow-svelte/drag";
    import { keyboard } from "@fragiola/flow-svelte/keyboard";
    import { selection } from "@fragiola/flow-svelte/selection";
    import type { Shape } from "./border-intersection";

    // Floating edges: no handle anywhere. Each edge reads its two nodes' boxes as the engine places
    // them (`useInternalNode(id).current.rect`, which redraws the edge while a node is dragged) and
    // draws itself between their borders (`border-intersection.ts`): where the line between the
    // centres leaves a rectangle, or the ellipse of a round node, drawn straight or as a bezier
    // that leaves and enters square to the side it meets; or, "simple", from the middle of each
    // node's side nearest the other. The path itself comes from the core's helpers
    // (`straightPath`, `bezierPath`). Pick the variant above the flow; the edges say theirs
    // (`data-variant`).

    export interface Types extends FlowTypes {
        readonly nodes: { shape: { label: string; shape: Shape } };
    }

    export type Variant = "straight" | "bezier" | "simple";

    const VARIANTS: readonly { value: Variant; label: string }[] = [
        { value: "straight", label: "Straight" },
        { value: "bezier", label: "Bezier" },
        { value: "simple", label: "Simple" },
    ];

    export const features = [selection(), drag(), keyboard()] as const;

    const shape = (
        id: string,
        label: string,
        kind: Shape,
        x: number,
        y: number,
        width: number,
        height: number,
    ): FlowNodeInput<Types> => ({
        id,
        type: "shape",
        position: { x, y },
        width,
        height,
        data: { label, shape: kind },
    });

    const nodes: FlowNodeInput<Types>[] = [
        shape("hub", "Hub", "ellipse", 300, 180, 110, 110),
        shape("wide", "Wide box", "rect", 0, 20, 220, 64),
        shape("tall", "Tall box", "rect", 620, 0, 96, 150),
        shape("oval", "Oval", "ellipse", 20, 380, 180, 84),
        shape("square", "Square", "rect", 600, 380, 100, 100),
    ];

    const link = (source: string, target: string): FlowEdgeInput<Types> => ({
        id: `${source}-${target}`,
        source,
        target,
    });

    const edges: FlowEdgeInput<Types>[] = [
        link("hub", "wide"),
        link("hub", "tall"),
        link("oval", "hub"),
        link("square", "hub"),
        link("wide", "oval"),
        link("tall", "square"),
    ];

    export const LABELS: Record<string, string> = Object.fromEntries(
        nodes.map((node) => [node.id, node.data.label]),
    );
</script>

<script lang="ts">
    import { typedFlow } from "@fragiola/flow-svelte";
    import FloatingEdge from "./floating-edge.svelte";
    import { styles } from "./styles";

    const Flow = typedFlow<Types, typeof features>();
    let variant = $state<Variant>("straight");
    // the radios' group name, unique to this flow: two of them on a page never share it
    const group = $props.id();
</script>

<Flow.Root
    {features}
    defaultNodes={nodes}
    defaultEdges={edges}
    fitView={{ padding: 0.15, maxZoom: 1 }}
    role="group"
    aria-label="Floating edges"
    class={styles.root}
>
    <Flow.Background variant="dots" size={2} class={styles.dots} />
    <Flow.Background variant="lines" class={styles.lines} />
    <Flow.Background variant="cross" class={styles.cross} />
    <Flow.Viewport>
        <Flow.Edges>
            {#snippet children(edge)}
                <FloatingEdge {edge} {variant} />
            {/snippet}
        </Flow.Edges>
        <Flow.Nodes>
            {#snippet children(node)}
                <Flow.Node
                    {node}
                    role="group"
                    aria-roledescription="node"
                    aria-label={node.data.label}
                    class={styles.node(node.data.shape)}
                >
                    {node.data.label}
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
    </Flow.Viewport>
    <fieldset class={styles.panel}>
        <legend class={styles.legend}>Edge path</legend>
        {#each VARIANTS as option (option.value)}
            <label class={styles.option}>
                <input
                    type="radio"
                    name={group}
                    value={option.value}
                    bind:group={variant}
                    class={styles.radio}
                />
                {option.label}
            </label>
        {/each}
    </fieldset>
</Flow.Root>
