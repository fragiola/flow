<script setup lang="ts">
import { useFlow } from "@fragiola/flow-vue";
import { onUnmounted } from "vue";
import type { features, Types } from "./index.vue";

// Puts a dropped item into the group under its centre (or takes it out of its group). It renders
// nothing: inside the root, it listens to the engine's `nodes-move` events.

const { model, engine } = useFlow<Types, typeof features>();

const unsubscribe = engine.subscribe((event) => {
    if (event.type !== "nodes-move") return;
    for (const nodeId of event.nodeIds) {
        const node = model.get("node-by", { id: nodeId });
        if (node?.type !== "item") continue;
        const rect = engine.get("node-rect-by", { nodeId });
        if (!rect) continue;
        const centre = {
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
        };
        const group = model.get("all-nodes").find((candidate) => {
            if (candidate.type !== "group") return false;
            const box = engine.get("node-rect-by", { nodeId: candidate.id });
            return (
                box !== undefined &&
                centre.x >= box.x &&
                centre.x <= box.x + box.width &&
                centre.y >= box.y &&
                centre.y <= box.y + box.height
            );
        });
        const parentId = group?.id ?? null;
        if ((node.parentId ?? null) === parentId) continue;
        model.run("node.set-parent", {
            nodeId,
            parentId,
            extent: parentId ? "parent" : null,
        });
    }
});
onUnmounted(unsubscribe);
</script>

<template></template>
