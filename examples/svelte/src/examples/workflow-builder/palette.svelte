<script module lang="ts">
    import { CATALOG, type CatalogEntry } from "./catalog";
    import { styles } from "./styles";

    // The step palette: each entry is dragged onto the canvas with the browser's drag and drop, or
    // clicked to add the step in the middle of the view.

    export const STEP_MIME = "application/x-workflow-step";

    const GROUPS = ["Triggers", "Actions", "Logic"] as const;
</script>

<script lang="ts">
    let { onadd }: { onadd: (entry: CatalogEntry) => void } = $props();

    function onDragStart(event: DragEvent, entry: CatalogEntry): void {
        event.dataTransfer?.setData(STEP_MIME, entry.id);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
    }
</script>

<nav aria-label="Steps" class={styles.palette}>
    {#each GROUPS as group (group)}
        <section aria-labelledby={`palette-${group}`} class={styles.paletteGroup}>
            <h3 id={`palette-${group}`} class={styles.paletteHeading}>
                {group}
            </h3>
            {#each CATALOG.filter((item) => item.group === group) as entry (entry.id)}
                <button
                    type="button"
                    draggable="true"
                    class={styles.paletteItem}
                    ondragstart={(event) => onDragStart(event, entry)}
                    onclick={() => onadd(entry)}
                >
                    <span class={styles.paletteIcon(group)}>
                        <entry.icon />
                    </span>
                    {entry.label}
                </button>
            {/each}
        </section>
    {/each}
</nav>
