<!-- A call between two services; its label shows from a zoom of 1. -->
<script lang="ts">
    import { type FlowEdge, typedFlow, useFlowStore } from "@fragiola/flow-svelte";
    import { showsLabels } from "./detail";
    import { type features, labelOf, type Types } from "./index.svelte";
    import { styles } from "./styles";

    let { edge }: { edge: FlowEdge<Types> } = $props();

    const Flow = typedFlow<Types, typeof features>();
    const labelled = useFlowStore<boolean, Types, typeof features>(({ engine }) =>
        showsLabels(engine.get("viewport").zoom),
    );
    const text = $derived(edge.type === "call" ? (edge.data?.label ?? "") : "");
</script>

<Flow.Edge
    {edge}
    role="group"
    aria-roledescription="edge"
    aria-label={`${labelOf(edge.source)} to ${labelOf(edge.target)}: ${text}`}
    class={styles.edgeGroup}
>
    <Flow.EdgePath class={styles.edge} />
    {#if labelled.current}
        <Flow.EdgeLabel class={styles.label}>{text}</Flow.EdgeLabel>
    {/if}
</Flow.Edge>
