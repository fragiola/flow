<script setup lang="ts">
import { type FlowEdge, typedFlow, useEdge } from "@fragiola/flow-vue";
import { computed } from "vue";
import { type features, LABELS, type Types } from "./index.vue";
import { DASH_PERIOD, describeMotion, travelSeconds } from "./motion";
import { styles } from "./styles";

// An animated edge: a dot travelling its path, dashes flowing along it, or one pulse when a value
// passes, each still under reduced motion but the pulse.

const props = defineProps<{
    edge: FlowEdge<Types>;
    reduced: boolean;
    sending: boolean;
}>();
const emit = defineEmits<{ arrive: [] }>();

const Flow = typedFlow<Types, typeof features>();
const { state } = useEdge<Types>(() => props.edge);
const motion = computed(() =>
    props.edge.type === "animated" && props.edge.data
        ? props.edge.data.motion
        : "dash",
);
const moving = computed(() => motion.value !== "pulse" && !props.reduced);
const pulsing = computed(() => motion.value === "pulse" && props.sending);

function onAnimationEnd(event: AnimationEvent) {
    // only the group's own pulse, not an animation inside it
    if (event.target === event.currentTarget && pulsing.value) emit("arrive");
}
</script>

<template>
    <Flow.Edge
        :edge="edge"
        role="group"
        aria-roledescription="edge"
        :aria-label="`${LABELS[edge.source]} to ${LABELS[edge.target]}: ${describeMotion(motion, reduced)}`"
        :data-reduced-motion="motion !== 'pulse' && reduced ? '' : undefined"
        :data-pulsing="pulsing ? '' : undefined"
        :class="styles.edgeGroup"
        @animationend="onAnimationEnd"
    >
        <!-- a wide transparent path: a bigger target for a click -->
        <Flow.EdgePath :class="styles.edgeHit" />
        <Flow.EdgePath :class="styles.edge(motion)">
            <!-- the path's own element, to hold the dashes' animate -->
            <template #render="{ props: path }">
                <path v-bind="path">
                    <animate
                        v-if="motion === 'dash' && moving"
                        attributeName="stroke-dashoffset"
                        :from="DASH_PERIOD"
                        :to="0"
                        dur="0.8s"
                        repeatCount="indefinite"
                    />
                </path>
            </template>
        </Flow.EdgePath>
        <circle
            v-if="motion === 'travel' && moving && state.path"
            :r="6"
            data-testid="traveller"
            :class="styles.traveller"
        >
            <animateMotion
                :path="state.path.path"
                :dur="`${travelSeconds(state.path.source, state.path.target)}s`"
                repeatCount="indefinite"
            />
        </circle>
    </Flow.Edge>
</template>
