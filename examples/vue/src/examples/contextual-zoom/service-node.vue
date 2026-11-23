<script setup lang="ts">
import { type FlowNode, typedFlow, useFlowStore } from "@fragiola/flow-vue";
import { Badge } from "#/components/atoms/badge";
import { atLeast, type Detail, detailOf } from "./detail";
import type { features, Types } from "./index.vue";
import { styles } from "./styles";

// A service: its name; from medium detail its kind and health; at high its owner and figures.

defineProps<{ node: FlowNode<Types> }>();

const Flow = typedFlow<Types, typeof features>();
// the detail level at the current zoom; re-renders only when the level changes
const detail = useFlowStore<Detail, Types, typeof features>(({ engine }) =>
    detailOf(engine.get("viewport").zoom),
);
</script>

<template>
    <Flow.Node
        :node="node"
        role="group"
        aria-roledescription="service"
        :aria-label="node.data.label"
        :data-detail="detail"
        :class="styles.node"
    >
        <Flow.Handle type="target" side="left" :class="styles.handle" />
        <span :class="styles.title">{{ node.data.label }}</span>
        <span v-if="atLeast(detail, 'medium')" :class="styles.summary">
            <span>{{ node.data.kind }}</span>
            <Badge variant="soft" :class="styles.health(node.data.health)">
                {{ node.data.health }}
            </Badge>
        </span>
        <dl v-if="atLeast(detail, 'high')" :class="styles.facts">
            <dt :class="styles.term">Owner</dt>
            <dd>{{ node.data.owner }}</dd>
            <dt :class="styles.term">Load</dt>
            <dd>{{ node.data.requests }}</dd>
            <dt :class="styles.term">p95</dt>
            <dd>{{ node.data.latency }}</dd>
        </dl>
        <Flow.Handle type="source" side="right" :class="styles.handle" />
    </Flow.Node>
</template>
