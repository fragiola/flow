<!-- A node rendered by hand (`useNode`): tells in its `$effect` and `onMount` whether it is registered. -->
<script lang="ts">
    import { onMount, untrack } from "svelte";
    import { type FlowNode, useFlow, useNode } from "../../src/index.js";

    let { node, seen }: { node: FlowNode; seen: [string, boolean][] } =
        $props();
    const { engine } = useFlow();
    const own = useNode(() => node);
    const registered = () =>
        engine.check("focus-node", { nodeId: node.id }).ok;
    $effect(() => {
        untrack(() => seen.push([`hand ${node.id} effect`, registered()]));
    });
    onMount(() => {
        seen.push([`hand ${node.id} mount`, registered()]);
    });
</script>

<div {...own.props}></div>
