<script setup lang="ts">
import { type FlowEdge, useFlow } from "@fragiola/flow-vue";
import { XIcon } from "@lucide/vue";
import type { features, Types } from "./index.vue";
import { styles } from "./styles";

// A button in an edge's label: it removes the edge (`edge.remove`).

defineProps<{ edge: FlowEdge<Types> }>();

const { model } = useFlow<Types, typeof features>();
</script>

<template>
    <button
        type="button"
        :aria-label="`Remove the edge from ${edge.source} to ${edge.target}`"
        :class="styles.remove"
        @click="model.run('edge.remove', { edgeId: edge.id })"
    >
        <XIcon />
    </button>
</template>
