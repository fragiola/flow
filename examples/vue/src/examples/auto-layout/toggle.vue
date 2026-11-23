<script setup lang="ts">
import { type FlowNode, useFlowStore } from "@fragiola/flow-vue";
import { ChevronDownIcon, ChevronUpIcon } from "@lucide/vue";
import { computed, inject } from "vue";
import { ACTIONS, type features, type Types } from "./index.vue";
import { styles } from "./styles";
import { childrenOf, topicData } from "./tree";

// The collapse toggle of a topic with children (none on a leaf).

const props = defineProps<{ node: FlowNode<Types> }>();

const actions = inject(ACTIONS);
const parent = useFlowStore<boolean, Types, typeof features>(
    ({ model }) => childrenOf(model.get("all-edges"), props.node.id).length > 0,
);
const label = computed(() => topicData(props.node).label);
const collapsed = computed(() => topicData(props.node).collapsed ?? false);
</script>

<template>
    <button
        v-if="parent"
        type="button"
        :aria-expanded="!collapsed"
        :aria-label="`${collapsed ? 'Expand' : 'Collapse'} ${label}`"
        :class="styles.toggle"
        @click="actions?.toggle(node.id)"
    >
        <ChevronDownIcon v-if="collapsed" aria-hidden="true" :class="styles.icon" />
        <ChevronUpIcon v-else aria-hidden="true" :class="styles.icon" />
    </button>
</template>
