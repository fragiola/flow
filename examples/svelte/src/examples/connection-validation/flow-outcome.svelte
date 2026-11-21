<script lang="ts">
    import { useFlow } from "@fragiola/flow-svelte";
    import { type features, PORTS, type Types } from "./index.svelte";
    import { styles } from "./styles";

    // The legend, and how the last connection ended (the engine's events, inside the root).

    const { engine } = useFlow<Types, typeof features>();
    let outcome = $state("Drag from an output to an input.");

    $effect(() =>
        engine.subscribe((event) => {
            if (event.type === "connect") outcome = "Connected.";
            if (event.type === "connect-cancel") {
                outcome = event.refused
                    ? "Refused: the rules do not allow that connection."
                    : "Dropped nowhere: nothing changed.";
            }
        }),
    );
</script>

<div class={styles.legend}>
    {#each PORTS as port (port)}
        <span class={styles.key(port)}>{port}</span>
    {/each}
    <p role="status" data-testid="outcome" class={styles.outcome}>{outcome}</p>
</div>
