<!-- A node's content: tells in its `$effect` and its `onMount` whether its node is registered. -->
<script lang="ts">
    import { onMount, untrack } from "svelte";
    import { useFlow } from "../../src/index.js";

    let { id, seen }: { id: string; seen: [string, boolean][] } = $props();
    const { engine } = useFlow();
    const registered = () => engine.check("focus-node", { nodeId: id }).ok;
    $effect(() => {
        untrack(() => seen.push([`content ${id} effect`, registered()]));
    });
    onMount(() => {
        seen.push([`content ${id} mount`, registered()]);
    });
</script>

<span></span>
