<script module lang="ts">
    import type { BackgroundVariant, FlowNodeInput, FlowTypes } from "@fragiola/flow-svelte";
    import { drag } from "@fragiola/flow-svelte/drag";

    // `Flow.Background` draws one SVG pattern that pans and zooms with the flow: `dots`, `lines` or
    // `cross`, every `gap` flow units, its marks `size` units big, in `currentColor`. Two
    // backgrounds layer: here a coarse grid of lines every five cells over the chosen pattern.

    interface Types extends FlowTypes {
        readonly nodes: { card: { label: string } };
    }

    const features = [drag()] as const;

    const VARIANTS: { value: BackgroundVariant; label: string }[] = [
        { value: "dots", label: "Dots" },
        { value: "lines", label: "Lines" },
        { value: "cross", label: "Cross" },
    ];

    const GAPS = [16, 24, 40];

    const nodes: FlowNodeInput<Types>[] = [
        {
            id: "a",
            type: "card",
            position: { x: 0, y: 0 },
            data: { label: "Drag me" },
        },
        {
            id: "b",
            type: "card",
            position: { x: 240, y: 120 },
            data: { label: "Zoom out" },
        },
    ];
</script>

<script lang="ts">
    import { typedFlow } from "@fragiola/flow-svelte";
    import { styles } from "./styles";

    const Flow = typedFlow<Types, typeof features>();

    let variant = $state<BackgroundVariant>("dots");
    let gap = $state(24);
    let coarse = $state(true);
</script>

<div class={styles.layout}>
    <div role="toolbar" aria-label="Background" class={styles.toolbar}>
        <fieldset class={styles.group}>
            <legend class={styles.legend}>Pattern</legend>
            {#each VARIANTS as option (option.value)}
                <button
                    type="button"
                    aria-pressed={variant === option.value}
                    class={styles.segment}
                    onclick={() => (variant = option.value)}
                >
                    {option.label}
                </button>
            {/each}
        </fieldset>
        <fieldset class={styles.group}>
            <legend class={styles.legend}>Gap</legend>
            {#each GAPS as value (value)}
                <button
                    type="button"
                    aria-pressed={gap === value}
                    class={styles.segment}
                    onclick={() => (gap = value)}
                >
                    {value}
                </button>
            {/each}
        </fieldset>
        <label class={styles.check}>
            <input bind:checked={coarse} type="checkbox" />
            Coarse grid
        </label>
    </div>
    <Flow.Root
        {features}
        defaultNodes={nodes}
        fitView={{ padding: 0.2, maxZoom: 1 }}
        class={styles.root}
    >
        <Flow.Background
            data-testid="pattern"
            {variant}
            {gap}
            size={variant === "dots" ? 2.5 : variant === "cross" ? 8 : 1}
            class={styles.pattern}
        />
        {#if coarse}
            <Flow.Background
                data-testid="coarse-grid"
                variant="lines"
                gap={gap * 5}
                size={1.5}
                class={styles.coarse}
            />
        {/if}
        <Flow.Viewport>
            <Flow.Nodes>
                {#snippet children(node)}
                    <Flow.Node {node} class={styles.node}>
                        {node.data.label}
                    </Flow.Node>
                {/snippet}
            </Flow.Nodes>
        </Flow.Viewport>
    </Flow.Root>
</div>
