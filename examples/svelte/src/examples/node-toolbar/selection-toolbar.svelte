<script lang="ts">
    import { typedFlow, useFlow, useSelection } from "@fragiola/flow-svelte";
    import { Trash2Icon } from "@lucide/svelte";
    import { type features, type Tone, TONES, type Types } from "./index.svelte";
    import { styles } from "./styles";

    // The selection's toolbar, below the selected notes while there are two or more (`nodeIds`):
    // recolour them all (one `batch`) or delete them (`selection.remove`).

    const Flow = typedFlow<Types, typeof features>();
    const flow = useFlow<Types, typeof features>();
    const selected = useSelection<Types>();
    const nodeIds = $derived(selected.current.nodes.map((node) => node.id));

    function recolour(tone: Tone): void {
        flow.model.run("batch", {
            commands: nodeIds.map((nodeId) => ({
                command: "node.set-data" as const,
                payload: { nodeId, data: { tone } },
            })),
        });
    }
</script>

{#if nodeIds.length >= 2}
    <Flow.NodeToolbar
        {nodeIds}
        side="bottom"
        role="toolbar"
        aria-label={`${nodeIds.length} notes: actions`}
        class={styles.toolbar}
    >
        {#each TONES as tone (tone)}
            <button
                type="button"
                aria-label={`Make them ${tone}`}
                class={styles.tone(tone)}
                onclick={() => recolour(tone)}
            ></button>
        {/each}
        <button
            type="button"
            aria-label="Delete them"
            class={styles.delete}
            onclick={() => flow.model.run("selection.remove", {})}
        >
            <Trash2Icon />
        </button>
    </Flow.NodeToolbar>
{/if}
