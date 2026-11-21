<script module lang="ts">
    import type { FlowNodeInput, FlowTypes } from "@fragiola/flow-svelte";
    import { drag } from "@fragiola/flow-svelte/drag";
    import { selection } from "@fragiola/flow-svelte/selection";

    // `drag({ snapGrid })` moves a dragged node onto the grid: its top-left corner lands on a multiple
    // of the grid (the other dragged nodes keep their offsets). The background draws the same grid
    // (`gap`). A feature's options are fixed when the model is made, so another grid size remounts the
    // root (`{#key}`), starting from the nodes as they are now.

    interface Types extends FlowTypes {
        readonly nodes: { card: { label: string } };
    }

    const SIZES = [10, 20, 40];

    const initial: FlowNodeInput<Types>[] = [
        {
            id: "a",
            type: "card",
            position: { x: 0, y: 0 },
            data: { label: "Snaps" },
        },
        {
            id: "b",
            type: "card",
            position: { x: 200, y: 80 },
            data: { label: "to the" },
        },
        {
            id: "c",
            type: "card",
            position: { x: 80, y: 200 },
            data: { label: "grid" },
        },
    ];

    /** The features for one grid size: the root reads them once, so another size remounts it. */
    const featuresFor = (grid: number) =>
        [selection(), drag({ snapGrid: [grid, grid] })] as const;

    type Features = ReturnType<typeof featuresFor>;
</script>

<script lang="ts">
    import { type FlowNode, typedFlow } from "@fragiola/flow-svelte";
    import { styles } from "./styles";

    const Flow = typedFlow<Types, Features>();

    let grid = $state(20);
    let features = $state.raw(featuresFor(20));
    // the nodes as they are now, for the next remount (not state: the root reads them once)
    const kept: { nodes: readonly FlowNodeInput<Types>[] } = { nodes: initial };
    const keep = (next: readonly FlowNode<Types>[]) => {
        kept.nodes = next;
    };
    function choose(size: number) {
        features = featuresFor(size);
        grid = size;
    }
</script>

<div class={styles.layout}>
    <fieldset class={styles.toolbar}>
        <legend class={styles.legend}>Grid size</legend>
        {#each SIZES as size (size)}
            <button
                type="button"
                aria-pressed={grid === size}
                class={styles.segment}
                onclick={() => choose(size)}
            >
                {size} px
            </button>
        {/each}
    </fieldset>
    {#key grid}
        <Flow.Root
            {features}
            defaultNodes={kept.nodes}
            fitView={{ padding: 0.2, maxZoom: 1 }}
            class={styles.root}
            onnodeschange={keep}
        >
            <Flow.Background variant="dots" gap={grid} size={2} class={styles.dots} />
            <Flow.Background variant="lines" gap={grid} class={styles.lines} />
            <Flow.Background variant="cross" gap={grid} class={styles.cross} />
            <Flow.Viewport>
                <Flow.Nodes>
                    {#snippet children(node)}
                        <Flow.Node {node} class={styles.node}>
                            {node.data.label}
                            <span data-testid="position" class={styles.position}>
                                {node.position.x}, {node.position.y}
                            </span>
                        </Flow.Node>
                    {/snippet}
                </Flow.Nodes>
            </Flow.Viewport>
        </Flow.Root>
    {/key}
</div>
