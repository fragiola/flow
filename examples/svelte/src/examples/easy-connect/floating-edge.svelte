<script lang="ts">
    import { type FlowEdge, typedFlow, useEdge } from "@fragiola/flow-svelte";
    import { floatingLine } from "./floating-edge";
    import { type features, LABELS, NODE, type Types } from "./index.svelte";
    import { styles } from "./styles";

    // A floating edge: a line from border to border, between the two nodes' centres.

    let { edge }: { edge: FlowEdge<Types> } = $props();

    const Flow = typedFlow<Types, typeof features>();
    const own = useEdge<Types>(() => edge);
    const path = $derived(
        own.state.path
            ? floatingLine(own.state.path.source, own.state.path.target, NODE).path
            : undefined,
    );
</script>

{#if path}
    <Flow.Edge
        {edge}
        role="group"
        aria-roledescription="edge"
        aria-label={`${LABELS[edge.source] ?? edge.source} to ${LABELS[edge.target] ?? edge.target}`}
        class={styles.edgeGroup}
    >
        <!-- a wide transparent path: a bigger target for a tap -->
        <Flow.EdgePath d={path} class={styles.edgeHit} />
        <Flow.EdgePath d={path} class={styles.edge} />
    </Flow.Edge>
{/if}
