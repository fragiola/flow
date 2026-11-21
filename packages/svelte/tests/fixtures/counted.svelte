<!-- Tells when it mounts: a node's content that must survive its node's moves. -->
<script lang="ts">
    import { onMount } from "svelte";

    let { id, onmount }: { id: string; onmount?: (id: string) => void } =
        $props();
    onMount(() => onmount?.(id));
</script>

<span data-flow-part="label"></span>
