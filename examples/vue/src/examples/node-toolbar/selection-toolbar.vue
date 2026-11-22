<script setup lang="ts">
import { typedFlow, useFlow, useSelection } from "@fragiola/flow-vue";
import { Trash2Icon } from "@lucide/vue";
import { computed } from "vue";
import { type features, type Tone, TONES, type Types } from "./index.vue";
import { styles } from "./styles";

// The selection's toolbar, below the selected notes while there are two or more (`nodeIds`):
// recolour them all (one `batch`) or delete them (`selection.remove`).

const Flow = typedFlow<Types, typeof features>();
const { model } = useFlow<Types, typeof features>();
const selected = useSelection<Types>();
const nodeIds = computed(() => selected.value.nodes.map((node) => node.id));

function recolour(tone: Tone) {
    model.run("batch", {
        commands: nodeIds.value.map((nodeId) => ({
            command: "node.set-data" as const,
            payload: { nodeId, data: { tone } },
        })),
    });
}
</script>

<template>
    <Flow.NodeToolbar
        v-if="nodeIds.length >= 2"
        :node-ids="nodeIds"
        side="bottom"
        role="toolbar"
        :aria-label="`${nodeIds.length} notes: actions`"
        :class="styles.toolbar"
    >
        <button
            v-for="tone in TONES"
            :key="tone"
            type="button"
            :aria-label="`Make them ${tone}`"
            :class="styles.tone(tone)"
            @click="recolour(tone)"
        />
        <button
            type="button"
            aria-label="Delete them"
            :class="styles.delete"
            @click="model.run('selection.remove', {})"
        >
            <Trash2Icon />
        </button>
    </Flow.NodeToolbar>
</template>
