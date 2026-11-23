<script setup lang="ts">
import { useFlow, useSelection } from "@fragiola/flow-vue";
import { computed } from "vue";
import type { features, Types } from "./index.vue";
import { styles } from "./styles";

// Groups the selected top-level nodes into a new group, and ungroups the selected groups.

/** The room a new group leaves around its nodes, and above them for its title. */
const MARGIN = 20;
const TITLE = 24;

const { model, engine } = useFlow<Types, typeof features>();
const selection = useSelection<Types>();
const loose = computed(() =>
    selection.value.nodes.filter((node) => node.parentId === undefined),
);
const groups = computed(() =>
    selection.value.nodes.filter((node) => node.type === "group"),
);

function group() {
    const nodeIds = loose.value.map((node) => node.id);
    const bounds = engine.get("nodes-bounds", { nodeIds });
    if (!bounds) return;
    let count = 1;
    while (model.get("node-by", { id: `group-${count}` })) count += 1;
    const groupId = `group-${count}`;
    model.run("batch", {
        commands: [
            {
                command: "node.add",
                payload: {
                    id: groupId,
                    type: "group",
                    position: {
                        x: bounds.x - MARGIN,
                        y: bounds.y - MARGIN - TITLE,
                    },
                    width: bounds.width + 2 * MARGIN,
                    height: bounds.height + 2 * MARGIN + TITLE,
                    data: { label: `Group ${count}` },
                },
            },
            ...nodeIds.map((nodeId) => ({
                command: "node.set-parent" as const,
                payload: {
                    nodeId,
                    parentId: groupId,
                    extent: "parent" as const,
                },
            })),
            {
                command: "selection.set",
                payload: { nodeIds: [groupId], mode: "replace" },
            },
        ],
    });
}

function ungroup() {
    const groupIds = new Set(groups.value.map((node) => node.id));
    const children = model
        .get("all-nodes")
        .filter((node) => node.parentId && groupIds.has(node.parentId));
    model.run("batch", {
        commands: [
            ...children.map((node) => ({
                command: "node.set-parent" as const,
                payload: { nodeId: node.id, parentId: null, extent: null },
            })),
            ...[...groupIds].map((nodeId) => ({
                command: "node.remove" as const,
                payload: { nodeId },
            })),
        ],
    });
}
</script>

<template>
    <div
        role="toolbar"
        aria-label="Grouping"
        data-flow-no-gesture
        :class="styles.toolbar"
    >
        <button
            type="button"
            :disabled="loose.length < 2"
            :class="styles.button"
            @click="group"
        >
            Group selection
        </button>
        <button
            type="button"
            :disabled="groups.length === 0"
            :class="styles.button"
            @click="ungroup"
        >
            Ungroup
        </button>
    </div>
</template>
