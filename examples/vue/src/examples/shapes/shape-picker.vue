<script setup lang="ts">
import { typedFlow, useFlow } from "@fragiola/flow-vue";
import { PencilIcon } from "@lucide/vue";
import type { features, Node, Types } from "./index.vue";
import { SHAPE_NAMES, SHAPES, shapePath } from "./shape-path";
import { styles } from "./styles";

// The selected node's toolbar: one button per shape (`node.set-data`), and the label's pencil.

const Flow = typedFlow<Types, typeof features>();
defineProps<{ node: Node }>();
const emit = defineEmits<{ edit: [] }>();
const { model } = useFlow<Types, typeof features>();
</script>

<template>
    <Flow.NodeToolbar
        side="right"
        role="toolbar"
        :aria-label="`Shape of ${node.data.label}`"
        :class="styles.toolbar"
    >
        <button
            v-for="option in SHAPES"
            :key="option"
            type="button"
            :aria-label="SHAPE_NAMES[option]"
            :aria-pressed="node.data.shape === option"
            :class="styles.pick"
            @click="model.run('node.set-data', { nodeId: node.id, data: { shape: option } })"
        >
            <svg viewBox="0 0 22 16" aria-hidden="true">
                <path :d="shapePath(option, 22, 16, 1.5)" />
            </svg>
        </button>
        <button type="button" aria-label="Edit label" :class="styles.pick" @click="emit('edit')">
            <PencilIcon />
        </button>
    </Flow.NodeToolbar>
</template>
