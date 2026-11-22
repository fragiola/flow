<!-- Calls `watch` in its script: a rune that returns nothing (`useOnViewportChange`). -->
<script lang="ts">
    import { untrack } from "svelte";

    let { watch }: { watch: () => void } = $props();
    untrack(() => watch());
</script>
