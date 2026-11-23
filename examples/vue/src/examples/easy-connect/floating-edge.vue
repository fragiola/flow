<script setup lang="ts">
import { type FlowEdge, typedFlow, useEdge } from "@fragiola/flow-vue";
import { computed } from "vue";
import { floatingLine } from "./floating-edge";
import { type features, LABELS, NODE, type Types } from "./index.vue";
import { styles } from "./styles";

// A floating edge: a line from border to border, between the two nodes' centres.

const props = defineProps<{ edge: FlowEdge<Types> }>();

const Flow = typedFlow<Types, typeof features>();
const { state } = useEdge<Types>(() => props.edge);
const path = computed(() =>
    state.value.path
        ? floatingLine(state.value.path.source, state.value.path.target, NODE)
              .path
        : undefined,
);
</script>

<template>
    <Flow.Edge
        v-if="path"
        :edge="edge"
        role="group"
        aria-roledescription="edge"
        :aria-label="`${LABELS[edge.source] ?? edge.source} to ${LABELS[edge.target] ?? edge.target}`"
        :class="styles.edgeGroup"
    >
        <!-- a wide transparent path: a bigger target for a tap -->
        <Flow.EdgePath :d="path" :class="styles.edgeHit" />
        <Flow.EdgePath :d="path" :class="styles.edge" />
    </Flow.Edge>
</template>
