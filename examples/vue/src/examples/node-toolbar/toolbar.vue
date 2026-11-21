<script lang="ts">
let copies = 0;
</script>

<script setup lang="ts">
import { type FlowNode, typedFlow, useFlow } from "@fragiola/flow-vue";
import { CopyIcon, Trash2Icon } from "@lucide/vue";
import { type features, TONES, type Types } from "./index.vue";
import { styles } from "./styles";

// A note's toolbar: duplicate, recolour, delete. It reaches the model with `useFlow`, inside the
// root.

const Flow = typedFlow<Types, typeof features>();
const props = defineProps<{ node: FlowNode<Types> }>();
const { model } = useFlow<Types, typeof features>();

function duplicate() {
    copies += 1;
    const { node } = props;
    model.run("node.add", {
        id: `${node.id}-copy-${copies}`,
        type: "sticky",
        position: { x: node.position.x + 30, y: node.position.y + 30 },
        data: node.data,
    });
}
</script>

<template>
    <Flow.NodeToolbar
        role="toolbar"
        :aria-label="`${node.data.text}: actions`"
        :class="styles.toolbar"
    >
        <button
            type="button"
            aria-label="Duplicate"
            :class="styles.action"
            @click="duplicate"
        >
            <CopyIcon />
        </button>
        <button
            v-for="tone in TONES"
            :key="tone"
            type="button"
            :aria-label="`Make it ${tone}`"
            :aria-pressed="node.data.tone === tone"
            :class="styles.tone(tone)"
            @click="model.run('node.set-data', { nodeId: node.id, data: { tone } })"
        />
        <button
            type="button"
            aria-label="Delete"
            :class="styles.delete"
            @click="model.run('node.remove', { nodeId: node.id })"
        >
            <Trash2Icon />
        </button>
    </Flow.NodeToolbar>
</template>
