<!-- Tells the selected nodes' ids each time `useSelection` changes. -->
<script lang="ts">
    import { useSelection } from "../../src/index.js";

    let { onselection }: { onselection: (ids: string[]) => void } = $props();
    const selected = useSelection();
    $effect(() => {
        onselection(selected.current.nodes.map((node) => node.id));
    });
</script>
