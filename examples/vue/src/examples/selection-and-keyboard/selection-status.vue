<script setup lang="ts">
import { useSelection } from "@fragiola/flow-vue";
import { computed } from "vue";
import type { Types } from "./index.vue";
import { styles } from "./styles";

// What is selected, read with `useSelection()` inside the root.

const selected = useSelection<Types>();
const text = computed(() => {
    const { nodes, edges } = selected.value;
    const names = nodes.map((node) => node.data.label);
    return nodes.length === 0 && edges.length === 0
        ? "Nothing selected"
        : `${nodes.length} nodes, ${edges.length} edges selected${names.length > 0 ? `: ${names.join(", ")}` : ""}`;
});
</script>

<template>
    <div role="status" data-testid="selection" :class="styles.status">
        {{ text }}
    </div>
</template>
