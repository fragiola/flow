<!-- What the last deletion did: the `said` of the batches the model commits. -->
<script lang="ts">
    import { useFlow } from "@fragiola/flow-svelte";
    import type { Features, Types } from "./index.svelte";
    import { styles } from "./styles";

    const flow = useFlow<Types, Features>();
    let said = $state("Select a node and press Delete, or use its delete button.");

    $effect(() =>
        flow.model.subscribe((event) => {
            if (typeof event.meta?.said === "string") said = event.meta.said;
        }),
    );
</script>

<p role="status" data-testid="outcome" class={styles.status}>{said}</p>
