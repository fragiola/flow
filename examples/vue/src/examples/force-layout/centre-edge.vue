<script lang="ts">
/** A box's centre. */
const centre = (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
}) => ({
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
});
</script>

<script setup lang="ts">
import {
    type FlowEdge,
    straightPath,
    typedFlow,
    useInternalNode,
} from "@fragiola/flow-vue";
import { computed } from "vue";
import { type features, labelOf, type Types } from "./index.vue";
import { styles } from "./styles";

// An edge from centre to centre (no handles: a force layout has no sides), under the nodes.

const props = defineProps<{ edge: FlowEdge<Types> }>();

const Flow = typedFlow<Types, typeof features>();
// both nodes' boxes, followed while they move
const source = useInternalNode<Types>(() => props.edge.source);
const target = useInternalNode<Types>(() => props.edge.target);
const path = computed(() =>
    source.value?.measured && target.value?.measured
        ? straightPath({
              source: centre(source.value.rect),
              target: centre(target.value.rect),
          }).path
        : undefined,
);
</script>

<template>
    <Flow.Edge
        v-if="path"
        :edge="edge"
        role="group"
        aria-roledescription="edge"
        :aria-label="`${labelOf(edge.source)} to ${labelOf(edge.target)}`"
        :class="styles.edgeGroup"
    >
        <Flow.EdgePath :d="path" :class="styles.edge" />
    </Flow.Edge>
</template>
