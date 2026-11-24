<!-- The collapse toggle of a topic with children (none on a leaf). -->
<script lang="ts">
    import { type FlowNode, useFlowStore } from "@fragiola/flow-svelte";
    import { ChevronDownIcon, ChevronUpIcon } from "@lucide/svelte";
    import type { features, Types } from "./index.svelte";
    import { styles } from "./styles";
    import { childrenOf, topicData } from "./tree";

    let { node, ontoggle }: { node: FlowNode<Types>; ontoggle: (topicId: string) => void } =
        $props();

    const parent = useFlowStore<boolean, Types, typeof features>(
        ({ model }) => childrenOf(model.get("all-edges"), node.id).length > 0,
    );
    const label = $derived(topicData(node).label);
    const collapsed = $derived(topicData(node).collapsed ?? false);
    const Icon = $derived(collapsed ? ChevronDownIcon : ChevronUpIcon);
</script>

{#if parent.current}
    <button
        type="button"
        aria-expanded={!collapsed}
        aria-label={`${collapsed ? "Expand" : "Collapse"} ${label}`}
        onclick={() => ontoggle(node.id)}
        class={styles.toggle}
    >
        <Icon aria-hidden="true" class={styles.icon} />
    </button>
{/if}
