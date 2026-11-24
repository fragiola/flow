<!-- The node's own delete button: a button inside a node is left alone by the flow's gestures. -->
<script lang="ts">
    import { type FlowNode, useFlow } from "@fragiola/flow-svelte";
    import { Trash2Icon } from "@lucide/svelte";
    import { type Features, removeReconnecting, type Types } from "./index.svelte";
    import { styles } from "./styles";

    let { node }: { node: FlowNode<Types> } = $props();

    const flow = useFlow<Types, Features>();
</script>

<button
    type="button"
    aria-label={`Delete ${node.data.label}`}
    class={styles.remove}
    onclick={() => removeReconnecting(flow.model, [node.id])}
>
    <Trash2Icon aria-hidden="true" />
</button>
