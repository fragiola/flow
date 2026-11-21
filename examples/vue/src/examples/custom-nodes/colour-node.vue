<script setup lang="ts">
import { Flow, useFlow } from "@fragiola/flow-vue";
import type { features, Node, Types } from "./index.vue";
import { styles } from "./styles";

// The colour node: a colour field that writes the node's data (`node.set-data`).

defineProps<{ node: Extract<Node, { type: "colour" }> }>();

const { model } = useFlow<Types, typeof features>();
</script>

<template>
    <label :class="styles.field">
        <span :class="styles.caption">{{ node.data.label }}</span>
        <input
            type="color"
            :value="node.data.colour"
            :class="styles.colourInput"
            @input="
                model.run('node.set-data', {
                    nodeId: node.id,
                    data: { colour: ($event.target as HTMLInputElement).value },
                })
            "
        />
    </label>
    <Flow.Handle type="source" side="right" :class="styles.handle" />
</template>
