<!-- The selected edge's actions: flip a status (`edge.set-data`), remove the edge (`edge.remove`). -->
<script lang="ts">
    import { type FlowEdge, typedFlow, useFlow } from "@fragiola/flow-svelte";
    import { RefreshCwIcon, Trash2Icon } from "@lucide/svelte";
    import type { features, Types } from "./index.svelte";
    import { styles } from "./styles";

    const Flow = typedFlow<Types, typeof features>();
    let { edge }: { edge: FlowEdge<Types> } = $props();
    const flow = useFlow<Types, typeof features>();

    function flip(): void {
        if (edge.type !== "status") return;
        flow.model.run("edge.set-data", {
            edgeId: edge.id,
            data: { status: edge.data?.status === "failing" ? "passing" : "failing" },
        });
    }
</script>

<Flow.EdgeToolbar
    offset={{ x: 0, y: -36 }}
    role="toolbar"
    aria-label={`${edge.source} to ${edge.target}: actions`}
    class={styles.toolbar}
>
    {#if edge.type === "status"}
        <button
            type="button"
            aria-label={edge.data?.status === "failing" ? "Mark it passing" : "Mark it failing"}
            class={styles.action}
            onclick={flip}
        >
            <RefreshCwIcon />
        </button>
    {/if}
    <button
        type="button"
        aria-label="Remove it"
        class={styles.danger}
        onclick={() => flow.model.run("edge.remove", { edgeId: edge.id })}
    >
        <Trash2Icon />
    </button>
</Flow.EdgeToolbar>
