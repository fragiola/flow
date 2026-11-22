<script setup lang="ts">
import { useNodeConnections, useNodeId, useNodesData } from "@fragiola/flow-vue";
import { computed } from "vue";
import type { Types } from "./index.vue";
import { styles } from "./styles";

// The sum of the nodes connected into this one: its connections, then their data.

const nodeId = useNodeId();
const connections = useNodeConnections({ type: "target" });
const inputs = useNodesData<Types>(() =>
    connections.value.map((connection) => connection.source),
);
const sum = computed(() => {
    let total = 0;
    const labels: string[] = [];
    for (const input of inputs.value) {
        if (input.type !== "number") continue;
        total += input.data.value;
        labels.push(input.data.label);
    }
    return { total, labels };
});
</script>

<template>
    <div :class="styles.sum">
        <span :class="styles.title">Sum</span>
        <output data-testid="sum-total" :class="styles.total">{{ sum.total }}</output>
        <span data-testid="sum-sources" :class="styles.sources">
            {{ sum.labels.length > 0 ? `of ${sum.labels.join(" + ")}` : `nothing into ${nodeId}` }}
        </span>
    </div>
</template>
