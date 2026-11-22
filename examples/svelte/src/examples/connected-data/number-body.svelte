<!-- A number's value, with its steppers: `node.set-data` from the model. -->
<script lang="ts">
    import { useFlow } from "@fragiola/flow-svelte";
    import { MinusIcon, PlusIcon } from "@lucide/svelte";
    import type { features, Node, Types } from "./index.svelte";
    import { styles } from "./styles";

    let { node }: { node: Extract<Node, { type: "number" }> } = $props();

    const flow = useFlow<Types, typeof features>();
    const step = (by: number) =>
        flow.model.run("node.set-data", {
            nodeId: node.id,
            data: { value: node.data.value + by },
        });
</script>

<div class={styles.row}>
    <span class={styles.title}>{node.data.label}</span>
    <button
        type="button"
        aria-label="Decrease {node.data.label}"
        onclick={() => step(-1)}
        class={styles.step}
    >
        <MinusIcon />
    </button>
    <output data-testid="value-{node.id}" class={styles.value}>{node.data.value}</output>
    <button
        type="button"
        aria-label="Increase {node.data.label}"
        onclick={() => step(1)}
        class={styles.step}
    >
        <PlusIcon />
    </button>
</div>
