<script setup lang="ts">
import { Flow, useFlow } from "@fragiola/flow-vue";
import type { features, Node, Types } from "./index.vue";
import { styles } from "./styles";

// The number node: a range that writes the node's data (`node.set-data`).

defineProps<{ node: Extract<Node, { type: "number" }> }>();

const { model } = useFlow<Types, typeof features>();
</script>

<template>
    <label :class="styles.field">
        <span :class="styles.caption">{{ node.data.label }}</span>
        <input
            type="range"
            :min="16"
            :max="96"
            :value="node.data.value"
            :class="styles.range"
            @input="
                model.run('node.set-data', {
                    nodeId: node.id,
                    data: {
                        value: Number(($event.target as HTMLInputElement).value),
                    },
                })
            "
        />
        <output :class="styles.value">{{ node.data.value }}px</output>
    </label>
    <Flow.Handle type="source" side="right" :class="styles.handle" />
</template>
