<script setup lang="ts">
import { type FlowNode, useFlow } from "@fragiola/flow-vue";
import { Trash2Icon } from "@lucide/vue";
import { type Features, removeReconnecting, type Types } from "./index.vue";
import { styles } from "./styles";

// The node's own delete button: a button inside a node is left alone by the flow's gestures.

defineProps<{ node: FlowNode<Types> }>();

const { model } = useFlow<Types, Features>();
</script>

<template>
    <button
        type="button"
        :aria-label="`Delete ${node.data.label}`"
        :class="styles.remove"
        @click="removeReconnecting(model, [node.id])"
    >
        <Trash2Icon aria-hidden="true" />
    </button>
</template>
