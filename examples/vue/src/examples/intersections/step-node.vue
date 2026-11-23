<script setup lang="ts">
import { type FlowNode, typedFlow, useFlowStore } from "@fragiola/flow-vue";
import type { features, Types } from "./index.vue";
import { styles } from "./styles";

// A node, marked while a dragged node overlaps it.

const props = defineProps<{ node: FlowNode<Types> }>();

const Flow = typedFlow<Types, typeof features>();
const intersecting = useFlowStore<boolean, Types, typeof features>(
    ({ engine }) => {
        const dragging = engine.get("dragging-node-ids");
        if (dragging.length === 0 || dragging.includes(props.node.id)) {
            return false;
        }
        return engine
            .get("intersecting-nodes", { nodeId: props.node.id })
            .some((other) => dragging.includes(other.id));
    },
);
</script>

<template>
    <Flow.Node
        :node="node"
        role="group"
        aria-roledescription="node"
        :aria-label="node.data.label"
        :data-intersecting="intersecting ? '' : undefined"
        :class="styles.node"
    >
        <Flow.Handle type="target" side="left" :class="styles.handle" />
        {{ node.data.label }}
        <Flow.Handle type="source" side="right" :class="styles.handle" />
    </Flow.Node>
</template>
