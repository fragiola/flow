<script setup lang="ts">
import { type Connection, useFlowStore } from "@fragiola/flow-vue";
import type { features, Types } from "./index.vue";
import { elbowPath, otherSources, type Start, sameStarts } from "./multi-connection";
import { styles } from "./styles";

// The connection line's drawing, in flow coordinates: an elbow from the pressed handle, one from
// each other selected node's source handle, and a ring where they meet.

const props = defineProps<{ connection: Connection }>();

const starts = useFlowStore<readonly Start[], Types, typeof features>(
    ({ model, engine }) =>
        otherSources(
            props.connection.from.nodeId,
            model.get("selected-nodes").map((node) => node.id),
        ).flatMap((nodeId) => {
            const center = engine
                .get("handles-by", { nodeId })
                .find((handle) => handle.type === "source")?.center;
            return center ? [{ id: nodeId, ...center }] : [];
        }),
    sameStarts,
);
</script>

<template>
    <path
        v-for="start in starts"
        :key="start.id"
        data-testid="extra-line"
        :data-source="start.id"
        :d="elbowPath(start, connection.toPoint)"
        :class="styles.extra"
    />
    <path
        data-testid="custom-line"
        :d="elbowPath(connection.fromPoint, connection.toPoint)"
        :class="styles.line"
    />
    <circle
        :cx="connection.toPoint.x"
        :cy="connection.toPoint.y"
        :r="5"
        :class="styles.end"
    />
</template>
