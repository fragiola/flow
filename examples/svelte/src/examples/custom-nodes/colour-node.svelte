<!-- The colour node: a colour field that writes the node's data (`node.set-data`). -->
<script lang="ts">
    import { Flow, useFlow } from "@fragiola/flow-svelte";
    import type { features, Node, Types } from "./index.svelte";
    import { styles } from "./styles";

    let { node }: { node: Extract<Node, { type: "colour" }> } = $props();

    const flow = useFlow<Types, typeof features>();
</script>

<label class={styles.field}>
    <span class={styles.caption}>{node.data.label}</span>
    <input
        type="color"
        value={node.data.colour}
        class={styles.colourInput}
        oninput={(event) =>
            flow.model.run("node.set-data", {
                nodeId: node.id,
                data: { colour: event.currentTarget.value },
            })}
    />
</label>
<Flow.Handle type="source" side="right" class={styles.handle} />
