<!-- The number node: a range that writes the node's data (`node.set-data`). -->
<script lang="ts">
    import { Flow, useFlow } from "@fragiola/flow-svelte";
    import type { features, Node, Types } from "./index.svelte";
    import { styles } from "./styles";

    let { node }: { node: Extract<Node, { type: "number" }> } = $props();

    const flow = useFlow<Types, typeof features>();
</script>

<label class={styles.field}>
    <span class={styles.caption}>{node.data.label}</span>
    <input
        type="range"
        min={16}
        max={96}
        value={node.data.value}
        class={styles.range}
        oninput={(event) =>
            flow.model.run("node.set-data", {
                nodeId: node.id,
                data: { value: Number(event.currentTarget.value) },
            })}
    />
    <output class={styles.value}>{node.data.value}px</output>
</label>
<Flow.Handle type="source" side="right" class={styles.handle} />
