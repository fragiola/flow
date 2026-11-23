<script setup lang="ts">
import { useFlowStore } from "@fragiola/flow-vue";
import { type features, linkFor, type Types } from "./index.vue";
import { type Link, sameLink } from "./proximity";
import { styles } from "./styles";

// The temporary edge: a dashed line in flow coordinates, inside the viewport, while the dragged
// node is near another. Not a `Flow.Edge`: it is not in the document, nor focusable.

const props = defineProps<{ nodeId: string }>();

const link = useFlowStore<Link | undefined, Types, typeof features>(
    ({ model, engine }) => linkFor(model, engine, props.nodeId),
    sameLink,
);
</script>

<template>
    <svg v-if="link" aria-hidden="true" :class="styles.overlay">
        <line
            data-testid="temporary-edge"
            :data-source="link.source"
            :data-target="link.target"
            :x1="link.from.x"
            :y1="link.from.y"
            :x2="link.to.x"
            :y2="link.to.y"
            :class="styles.temporary"
        />
    </svg>
</template>
