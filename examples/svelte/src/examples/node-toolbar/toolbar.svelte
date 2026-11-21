<script module lang="ts">
    let copies = 0;
</script>

<script lang="ts">
    import { type FlowNode, typedFlow, useFlow } from "@fragiola/flow-svelte";
    import { CopyIcon, Trash2Icon } from "@lucide/svelte";
    import { type features, TONES, type Types } from "./index.svelte";
    import { styles } from "./styles";

    // A note's toolbar: duplicate, recolour, delete. It reaches the model with `useFlow`, inside
    // the root.

    const Flow = typedFlow<Types, typeof features>();
    let { node }: { node: FlowNode<Types> } = $props();
    const flow = useFlow<Types, typeof features>();

    function duplicate(): void {
        copies += 1;
        flow.model.run("node.add", {
            id: `${node.id}-copy-${copies}`,
            type: "sticky",
            position: { x: node.position.x + 30, y: node.position.y + 30 },
            data: node.data,
        });
    }
</script>

<Flow.NodeToolbar role="toolbar" aria-label={`${node.data.text}: actions`} class={styles.toolbar}>
    <button type="button" aria-label="Duplicate" class={styles.action} onclick={duplicate}>
        <CopyIcon />
    </button>
    {#each TONES as tone (tone)}
        <button
            type="button"
            aria-label={`Make it ${tone}`}
            aria-pressed={node.data.tone === tone}
            class={styles.tone(tone)}
            onclick={() => flow.model.run("node.set-data", { nodeId: node.id, data: { tone } })}
        ></button>
    {/each}
    <button
        type="button"
        aria-label="Delete"
        class={styles.delete}
        onclick={() => flow.model.run("node.remove", { nodeId: node.id })}
    >
        <Trash2Icon />
    </button>
</Flow.NodeToolbar>
