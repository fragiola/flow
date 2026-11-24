<!-- An edge, named by its topics: "Marketing to Campaign", or "Marketing to its add button". -->
<script lang="ts">
    import { type FlowEdge, typedFlow, useFlowStore } from "@fragiola/flow-svelte";
    import type { features, Types } from "./index.svelte";
    import { styles } from "./styles";
    import { isPlaceholder, topicData } from "./tree";

    let { edge }: { edge: FlowEdge<Types> } = $props();

    const Flow = typedFlow<Types, typeof features>();

    /** A topic's label, read from the document (an added topic's too); none for a placeholder. */
    const labelOf = (id: () => string) =>
        useFlowStore<string, Types, typeof features>(({ model }) => {
            const node = model.get("node-by", { id: id() });
            return node && !isPlaceholder(id()) ? topicData(node).label : id();
        });

    const source = labelOf(() => edge.source);
    const target = labelOf(() => edge.target);
    const placeholder = $derived(isPlaceholder(edge.target));
</script>

<Flow.Edge
    {edge}
    role="group"
    aria-roledescription="edge"
    aria-label={placeholder
        ? `${source.current} to its add button`
        : `${source.current} to ${target.current}`}
    class={styles.edgeGroup}
>
    <Flow.EdgePath class={placeholder ? styles.placeholderEdge : styles.edge} />
</Flow.Edge>
