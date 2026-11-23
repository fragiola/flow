<script setup lang="ts">
import { type Rect, useFlow } from "@fragiola/flow-vue";
import { RouteIcon, SplineIcon } from "@lucide/vue";
import { ref } from "vue";
import { type features, nameOf, type Types } from "./index.vue";
import { routeAround } from "./routing";
import { styles } from "./styles";

// The actions over every editable edge: route them around the nodes, or straighten them.

const { model, engine } = useFlow<Types, typeof features>();
const status = ref("");

function route() {
    const obstacles = model
        .get("all-nodes")
        .map((node) => engine.get("node-rect-by", { nodeId: node.id }))
        .filter((rect): rect is Rect => rect !== undefined);
    const stuck: string[] = [];
    const commands = model.get("all-edges").flatMap((edge) => {
        const path = engine.get("edge-path-by", { edgeId: edge.id });
        if (!path) return [];
        const found = routeAround(
            {
                point: path.source,
                side: path.sourceSide,
                node: engine.get("node-rect-by", { nodeId: edge.source }),
            },
            {
                point: path.target,
                side: path.targetSide,
                node: engine.get("node-rect-by", { nodeId: edge.target }),
            },
            obstacles,
        );
        if (!found.found) stuck.push(nameOf(edge));
        return [
            {
                command: "edge.set-data" as const,
                payload: {
                    edgeId: edge.id,
                    data: { points: found.points },
                },
            },
        ];
    });
    model.run("batch", { commands });
    status.value =
        stuck.length === 0
            ? "Routed around the nodes."
            : `No way around for ${stuck.join(", ")}: a plain step stands in.`;
}

function clear() {
    model.run("batch", {
        commands: model.get("all-edges").map((edge) => ({
            command: "edge.set-data" as const,
            payload: { edgeId: edge.id, data: { points: [] } },
        })),
    });
    status.value = "The edges are straight.";
}
</script>

<template>
    <div :class="styles.panel">
        <div role="toolbar" aria-label="Edge actions" :class="styles.actions">
            <button type="button" :class="styles.action" @click="route">
                <RouteIcon />
                Route
            </button>
            <button type="button" :class="styles.action" @click="clear">
                <SplineIcon />
                Clear points
            </button>
        </div>
        <p :class="styles.hint">
            Double-click an edge to add a point, drag a point to bend it, Delete removes it.
        </p>
        <p role="status" :class="styles.status">{{ status }}</p>
    </div>
</template>
