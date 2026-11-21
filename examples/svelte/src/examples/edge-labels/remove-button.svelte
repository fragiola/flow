<!-- A button in an edge's label: it removes the edge (`edge.remove`). -->
<script lang="ts">
    import { type FlowEdge, useFlow } from "@fragiola/flow-svelte";
    import { XIcon } from "@lucide/svelte";
    import type { features, Types } from "./index.svelte";
    import { styles } from "./styles";

    let { edge }: { edge: FlowEdge<Types> } = $props();

    const flow = useFlow<Types, typeof features>();
</script>

<button
    type="button"
    aria-label={`Remove the edge from ${edge.source} to ${edge.target}`}
    class={styles.remove}
    onclick={() => flow.model.run("edge.remove", { edgeId: edge.id })}
>
    <XIcon />
</button>
