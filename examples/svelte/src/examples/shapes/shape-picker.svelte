<script lang="ts">
    import { typedFlow, useFlow } from "@fragiola/flow-svelte";
    import { PencilIcon } from "@lucide/svelte";
    import type { features, Node, Types } from "./index.svelte";
    import { SHAPE_NAMES, SHAPES, shapePath } from "./shape-path";
    import { styles } from "./styles";

    // The selected node's toolbar: one button per shape (`node.set-data`), and the label's pencil.

    const Flow = typedFlow<Types, typeof features>();
    let { node, onedit }: { node: Node; onedit: () => void } = $props();
    const flow = useFlow<Types, typeof features>();
</script>

<Flow.NodeToolbar
    side="right"
    role="toolbar"
    aria-label={`Shape of ${node.data.label}`}
    class={styles.toolbar}
>
    {#each SHAPES as option (option)}
        <button
            type="button"
            aria-label={SHAPE_NAMES[option]}
            aria-pressed={node.data.shape === option}
            onclick={() =>
                flow.model.run("node.set-data", { nodeId: node.id, data: { shape: option } })}
            class={styles.pick}
        >
            <svg viewBox="0 0 22 16" aria-hidden="true">
                <path d={shapePath(option, 22, 16, 1.5)} />
            </svg>
        </button>
    {/each}
    <button type="button" aria-label="Edit label" onclick={onedit} class={styles.pick}>
        <PencilIcon />
    </button>
</Flow.NodeToolbar>
