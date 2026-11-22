<!-- The sum of the nodes connected into this one: its connections, then their data. -->
<script lang="ts">
    import { useNodeConnections, useNodeId, useNodesData } from "@fragiola/flow-svelte";
    import type { Types } from "./index.svelte";
    import { styles } from "./styles";

    const nodeId = useNodeId();
    const connections = useNodeConnections({ type: "target" });
    const inputs = useNodesData<Types>(() =>
        connections.current.map((connection) => connection.source),
    );
    const sum = $derived.by(() => {
        let total = 0;
        const labels: string[] = [];
        for (const input of inputs.current) {
            if (input.type !== "number") continue;
            total += input.data.value;
            labels.push(input.data.label);
        }
        return { total, labels };
    });
</script>

<div class={styles.sum}>
    <span class={styles.title}>Sum</span>
    <output data-testid="sum-total" class={styles.total}>{sum.total}</output>
    <span data-testid="sum-sources" class={styles.sources}>
        {sum.labels.length > 0 ? `of ${sum.labels.join(" + ")}` : `nothing into ${nodeId}`}
    </span>
</div>
