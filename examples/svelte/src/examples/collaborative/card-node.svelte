<!-- A card, with the dashed frame of the other collaborators who have it selected (`names`, from
     `sync.ts`'s `remoteSelection`). -->
<script lang="ts">
    import { type FlowNode, typedFlow } from "@fragiola/flow-svelte";
    import type { features, Types } from "./index.svelte";
    import { styles } from "./styles";

    const {
        node,
        names,
    }: { node: FlowNode<Types>; names: readonly string[] | undefined } = $props();

    const Flow = typedFlow<Types, typeof features>();
    const by = $derived(names?.join(", "));
    // the first of them gives the mark its colour
    const lead = $derived(names?.[0]);
    // Svelte's element types have no `aria-description` yet (ARIA 1.3): given through a spread
    const description = $derived(
        by ? { "aria-description": `selected by ${by}` } : {},
    );
</script>

<Flow.Node
    {node}
    role="group"
    aria-roledescription="node"
    aria-label={node.data.label}
    {...description}
    data-remote-selected={by || undefined}
    class={styles.node}
>
    <Flow.Handle
        type="target"
        side="left"
        aria-label={`${node.data.label} input`}
        class={styles.handle}
    />
    {node.data.label}
    <Flow.Handle
        type="source"
        side="right"
        aria-label={`${node.data.label} output`}
        class={styles.handle}
    />
    {#if lead}
        <span aria-hidden="true" class={styles.mark(lead)}>
            <span class={styles.markName}>{by}</span>
        </span>
    {/if}
</Flow.Node>
