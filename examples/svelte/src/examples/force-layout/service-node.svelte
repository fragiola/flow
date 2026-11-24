<!-- A service: its label, its place (`data-position`) and, pinned in the simulation, a pin. -->
<script lang="ts">
    import { type FlowNode, typedFlow } from "@fragiola/flow-svelte";
    import { PinIcon } from "@lucide/svelte";
    import type { features, Types } from "./index.svelte";
    import { styles } from "./styles";

    let { node, pinned }: { node: FlowNode<Types>; pinned: boolean } = $props();

    const Flow = typedFlow<Types, typeof features>();
</script>

<Flow.Node
    {node}
    role="group"
    aria-roledescription="node"
    aria-label={node.data.label}
    data-position={`${Math.round(node.position.x)}, ${Math.round(node.position.y)}`}
    data-pinned={pinned ? "" : undefined}
    class={styles.node}
>
    {node.data.label}
    {#if pinned}
        <span class={styles.pin} aria-hidden="true">
            <PinIcon />
        </span>
    {/if}
</Flow.Node>
