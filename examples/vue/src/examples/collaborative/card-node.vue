<script setup lang="ts">
import { type FlowNode, typedFlow } from "@fragiola/flow-vue";
import { computed } from "vue";
import type { features, Types } from "./index.vue";
import { styles } from "./styles";

// A card, with the dashed frame of the other collaborators who have it selected (`names`, from
// `sync.ts`'s `remoteSelection`).

const props = defineProps<{
    node: FlowNode<Types>;
    names: readonly string[] | undefined;
}>();

const Flow = typedFlow<Types, typeof features>();
const by = computed(() => props.names?.join(", "));
// the first of them gives the mark its colour
const lead = computed(() => props.names?.[0]);
</script>

<template>
    <Flow.Node
        :node="node"
        role="group"
        aria-roledescription="node"
        :aria-label="node.data.label"
        :aria-description="by ? `selected by ${by}` : undefined"
        :data-remote-selected="by || undefined"
        :class="styles.node"
    >
        <Flow.Handle
            type="target"
            side="left"
            :aria-label="`${node.data.label} input`"
            :class="styles.handle"
        />
        {{ node.data.label }}
        <Flow.Handle
            type="source"
            side="right"
            :aria-label="`${node.data.label} output`"
            :class="styles.handle"
        />
        <span v-if="lead" aria-hidden="true" :class="styles.mark(lead)">
            <span :class="styles.markName">{{ by }}</span>
        </span>
    </Flow.Node>
</template>
