<script setup lang="ts">
import { type FlowNode, typedFlow } from "@fragiola/flow-vue";
import { PinIcon } from "@lucide/vue";
import { computed, inject, ref } from "vue";
import { type features, PINNED, type Types } from "./index.vue";
import { styles } from "./styles";

// A service: its label, its place (`data-position`) and, pinned in the simulation, a pin.

const props = defineProps<{ node: FlowNode<Types> }>();

const Flow = typedFlow<Types, typeof features>();

const pinnedIds = inject(PINNED, ref<ReadonlySet<string>>(new Set()));
const pinned = computed(() => pinnedIds.value.has(props.node.id));
</script>

<template>
    <Flow.Node
        :node="node"
        role="group"
        aria-roledescription="node"
        :aria-label="node.data.label"
        :data-position="`${Math.round(node.position.x)}, ${Math.round(node.position.y)}`"
        :data-pinned="pinned ? '' : undefined"
        :class="styles.node"
    >
        {{ node.data.label }}
        <span v-if="pinned" :class="styles.pin" aria-hidden="true">
            <PinIcon />
        </span>
    </Flow.Node>
</template>
