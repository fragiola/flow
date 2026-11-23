<script setup lang="ts">
import { useFlow } from "@fragiola/flow-vue";
import { onUnmounted, ref } from "vue";
import type { Features, Types } from "./index.vue";
import { styles } from "./styles";

// What the last deletion did: the `said` of the batches the model commits.

const { model } = useFlow<Types, Features>();
const said = ref("Select a node and press Delete, or use its delete button.");
const stop = model.subscribe((event) => {
    if (typeof event.meta?.said === "string") said.value = event.meta.said;
});
onUnmounted(stop);
</script>

<template>
    <p role="status" data-testid="outcome" :class="styles.status">
        {{ said }}
    </p>
</template>
