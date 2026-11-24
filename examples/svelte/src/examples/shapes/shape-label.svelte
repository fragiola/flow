<script lang="ts">
    import { useFlow } from "@fragiola/flow-svelte";
    import type { features, Node, Types } from "./index.svelte";
    import { styles } from "./styles";

    // The label, or its field while it is edited in place: Enter (or leaving the field) keeps it,
    // Escape drops it.

    let {
        node,
        editing,
        onediting,
    }: { node: Node; editing: boolean; onediting: (on: boolean) => void } = $props();

    const flow = useFlow<Types, typeof features>();
    // Escape drops the edit: the blur that follows must not keep it
    let dropped = false;

    /** The field opens on the user's request, to type in: focused, each edit starting undropped. */
    function focus(field: HTMLInputElement): void {
        dropped = false;
        field.focus();
    }

    function keep(value: string): void {
        const label = value.trim();
        if (label !== "" && label !== node.data.label) {
            flow.model.run("node.set-data", { nodeId: node.id, data: { label } });
        }
        onediting(false);
    }

    function onkeydown(event: KeyboardEvent & { currentTarget: HTMLInputElement }): void {
        if (event.key === "Enter") keep(event.currentTarget.value);
        if (event.key === "Escape") {
            dropped = true;
            onediting(false);
        }
    }

    function onblur(event: FocusEvent & { currentTarget: HTMLInputElement }): void {
        if (dropped) dropped = false;
        else keep(event.currentTarget.value);
    }
</script>

{#if editing}
    <input
        {@attach focus}
        aria-label={`Label of ${node.data.label}`}
        value={node.data.label}
        onfocus={(event) => event.currentTarget.select()}
        {onkeydown}
        {onblur}
        class={styles.field}
    />
{:else}
    <span class={styles.label}>{node.data.label}</span>
{/if}
