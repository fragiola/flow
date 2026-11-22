<script setup lang="ts">
import { type FlowEdge, typedFlow, useFlow } from "@fragiola/flow-vue";
import { RefreshCwIcon, Trash2Icon } from "@lucide/vue";
import type { features, Types } from "./index.vue";
import { styles } from "./styles";

// The selected edge's actions: flip a status (`edge.set-data`), remove the edge (`edge.remove`).

const Flow = typedFlow<Types, typeof features>();
const props = defineProps<{ edge: FlowEdge<Types> }>();
const { model } = useFlow<Types, typeof features>();

function flip() {
    const { edge } = props;
    if (edge.type !== "status") return;
    model.run("edge.set-data", {
        edgeId: edge.id,
        data: { status: edge.data?.status === "failing" ? "passing" : "failing" },
    });
}
</script>

<template>
    <Flow.EdgeToolbar
        :offset="{ x: 0, y: -36 }"
        role="toolbar"
        :aria-label="`${edge.source} to ${edge.target}: actions`"
        :class="styles.toolbar"
    >
        <button
            v-if="edge.type === 'status'"
            type="button"
            :aria-label="edge.data?.status === 'failing' ? 'Mark it passing' : 'Mark it failing'"
            :class="styles.action"
            @click="flip"
        >
            <RefreshCwIcon />
        </button>
        <button
            type="button"
            aria-label="Remove it"
            :class="styles.danger"
            @click="model.run('edge.remove', { edgeId: edge.id })"
        >
            <Trash2Icon />
        </button>
    </Flow.EdgeToolbar>
</template>
