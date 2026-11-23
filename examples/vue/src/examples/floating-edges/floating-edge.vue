<script lang="ts">
import {
    bezierPath,
    type InternalNode,
    straightPath,
} from "@fragiola/flow-vue";
import {
    type Box,
    type Ends,
    floatingEnds,
    simpleEnds,
} from "./border-intersection";
import type { Types, Variant } from "./index.vue";

/** A node's box as the engine places it, with its shape: what the border geometry reads. */
function boxOf(node: InternalNode<Types>): Box {
    return { ...node.rect, shape: node.node.data.shape };
}

/** The path of a variant between two nodes. */
function floatingPath(variant: Variant, source: Box, target: Box) {
    if (variant === "simple") {
        const ends = simpleEnds(source, target);
        return { ends, path: bezierPath(ends).path };
    }
    const ends: Ends = floatingEnds(source, target);
    const path =
        variant === "bezier" ? bezierPath(ends).path : straightPath(ends).path;
    return { ends, path };
}
</script>

<script setup lang="ts">
import {
    type FlowEdge,
    typedFlow,
    useInternalNode,
} from "@fragiola/flow-vue";
import { computed } from "vue";
import { type features, LABELS } from "./index.vue";
import { styles } from "./styles";

// An edge with no handle: drawn between its two nodes' borders, in the variant picked above the
// flow.

const props = defineProps<{ edge: FlowEdge<Types>; variant: Variant }>();

const Flow = typedFlow<Types, typeof features>();
// both nodes' boxes, followed while they move
const source = useInternalNode<Types>(() => props.edge.source);
const target = useInternalNode<Types>(() => props.edge.target);
const floating = computed(() =>
    source.value?.measured && target.value?.measured
        ? floatingPath(props.variant, boxOf(source.value), boxOf(target.value))
        : undefined,
);
</script>

<template>
    <Flow.Edge
        v-if="floating"
        :edge="edge"
        role="group"
        aria-roledescription="edge"
        :aria-label="`${LABELS[edge.source]} to ${LABELS[edge.target]}`"
        :data-variant="variant"
        :class="styles.edgeGroup"
    >
        <!-- a wide transparent path: a bigger target for a click -->
        <Flow.EdgePath :d="floating.path" :class="styles.edgeHit" />
        <Flow.EdgePath :d="floating.path" :class="styles.edge" />
        <!-- where the edge meets each border -->
        <circle
            :cx="floating.ends.source.x"
            :cy="floating.ends.source.y"
            :r="3"
            :class="styles.end"
        />
        <circle
            :cx="floating.ends.target.x"
            :cy="floating.ends.target.y"
            :r="3"
            :class="styles.end"
        />
    </Flow.Edge>
</template>
