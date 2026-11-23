<script setup lang="ts">
import { type FlowEdge, typedFlow, useFlowStore } from "@fragiola/flow-vue";
import { computed } from "vue";
import type { features, Types } from "./index.vue";
import { styles } from "./styles";
import { isPlaceholder, topicData } from "./tree";

// An edge, named by its topics: "Marketing to Campaign", or "Marketing to its add button".

const props = defineProps<{ edge: FlowEdge<Types> }>();

const Flow = typedFlow<Types, typeof features>();

/** A topic's label, read from the document (an added topic's too); none for a placeholder. */
const labelOf = (id: () => string) =>
    useFlowStore<string, Types, typeof features>(({ model }) => {
        const node = model.get("node-by", { id: id() });
        return node && !isPlaceholder(id()) ? topicData(node).label : id();
    });

const source = labelOf(() => props.edge.source);
const target = labelOf(() => props.edge.target);
const placeholder = computed(() => isPlaceholder(props.edge.target));
</script>

<template>
    <Flow.Edge
        :edge="edge"
        role="group"
        aria-roledescription="edge"
        :aria-label="placeholder ? `${source} to its add button` : `${source} to ${target}`"
        :class="styles.edgeGroup"
    >
        <Flow.EdgePath :class="placeholder ? styles.placeholderEdge : styles.edge" />
    </Flow.Edge>
</template>
