<!-- What is selected, read with `useSelection()` inside the root. -->
<script lang="ts">
    import { useSelection } from "@fragiola/flow-svelte";
    import type { Types } from "./index.svelte";
    import { styles } from "./styles";

    const selected = useSelection<Types>();
    const text = $derived.by(() => {
        const { nodes, edges } = selected.current;
        const names = nodes.map((node) => node.data.label);
        return nodes.length === 0 && edges.length === 0
            ? "Nothing selected"
            : `${nodes.length} nodes, ${edges.length} edges selected${names.length > 0 ? `: ${names.join(", ")}` : ""}`;
    });
</script>

<div role="status" data-testid="selection" class={styles.status}>{text}</div>
