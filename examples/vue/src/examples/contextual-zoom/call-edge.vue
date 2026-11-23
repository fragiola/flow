<script setup lang="ts">
import { type FlowEdge, typedFlow, useFlowStore } from "@fragiola/flow-vue";
import { computed } from "vue";
import { showsLabels } from "./detail";
import { type features, labelOf, type Types } from "./index.vue";
import { styles } from "./styles";

// A call between two services; its label shows from a zoom of 1.

const props = defineProps<{ edge: FlowEdge<Types> }>();

const Flow = typedFlow<Types, typeof features>();
const labelled = useFlowStore<boolean, Types, typeof features>(({ engine }) =>
    showsLabels(engine.get("viewport").zoom),
);
const text = computed(() =>
    props.edge.type === "call" ? (props.edge.data?.label ?? "") : "",
);
</script>

<template>
    <Flow.Edge
        :edge="edge"
        role="group"
        aria-roledescription="edge"
        :aria-label="`${labelOf(edge.source)} to ${labelOf(edge.target)}: ${text}`"
        :class="styles.edgeGroup"
    >
        <Flow.EdgePath :class="styles.edge" />
        <Flow.EdgeLabel v-if="labelled" :class="styles.label">{{ text }}</Flow.EdgeLabel>
    </Flow.Edge>
</template>
