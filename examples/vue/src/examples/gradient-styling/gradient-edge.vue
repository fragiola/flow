<script setup lang="ts">
import { type FlowEdge, typedFlow, useEdge } from "@fragiola/flow-vue";
import { computed } from "vue";
import { edgeGradient, gradientId, gradientUrl } from "./gradients";
import { type features, STEPS, type Types } from "./index.vue";
import { styles } from "./styles";

// An edge stroked with a `<linearGradient>` of its own, drawn in flow coordinates between its ends.

const props = defineProps<{ edge: FlowEdge<Types>; prefix: string }>();

const Flow = typedFlow<Types, typeof features>();
const { state } = useEdge<Types>(() => props.edge);
const source = computed(() => STEPS[props.edge.source]);
const target = computed(() => STEPS[props.edge.target]);
const gradient = computed(() =>
    edgeGradient(
        source.value?.kind ?? "transform",
        target.value?.kind ?? "transform",
    ),
);
</script>

<template>
    <Flow.Edge
        :edge="edge"
        role="group"
        aria-roledescription="edge"
        :aria-label="`${source?.label} to ${target?.label}`"
        :class="styles.edgeGroup"
    >
        <defs>
            <linearGradient
                :id="gradientId(prefix, edge.id)"
                gradientUnits="userSpaceOnUse"
                :x1="state.path?.source.x"
                :y1="state.path?.source.y"
                :x2="state.path?.target.x"
                :y2="state.path?.target.y"
            >
                <stop offset="0%" :class="styles.stop(gradient.from)" />
                <stop offset="100%" :class="styles.stop(gradient.to)" />
            </linearGradient>
        </defs>
        <!-- a wide transparent path: a bigger target for a click -->
        <Flow.EdgePath :class="styles.edgeHit" />
        <Flow.EdgePath :stroke="gradientUrl(prefix, edge.id)" :class="styles.edge" />
    </Flow.Edge>
</template>
