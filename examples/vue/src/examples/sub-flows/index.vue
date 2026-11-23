<script lang="ts">
import type {
    FlowEdgeInput,
    FlowNodeInput,
    FlowTypes,
} from "@fragiola/flow-vue";
import { drag } from "@fragiola/flow-vue/drag";
import { selection } from "@fragiola/flow-vue/selection";
import { subflows } from "@fragiola/flow-vue/subflows";

// `subflows()` gives a node a parent (`parentId`): its position is relative to the parent, it moves
// with it, and with `extent: "parent"` it stays inside it. Nodes are rendered flat (a child is not
// inside its parent's element), each at its absolute place. Drop a loose node onto a group and the
// app puts it in with `node.set-parent` (drop-into-groups.vue), which keeps it where it is on screen.
// With `zIndexMode="auto"` (the default, written here to show it) an edge with an end in a group is
// drawn at its ends' level: above the groups it crosses, under the nodes it joins; a selected edge
// rises above every node. `"basic"` keeps every edge under every node, and `"manual"` follows only
// the `zIndex` values.
//
// "Group selection" wraps two or more selected top-level nodes in a new group sized to their box
// (`nodes-bounds`) plus a margin: one `batch` of `node.add` and a `node.set-parent` per node, so
// they keep their places and one undo takes it back. "Ungroup" puts the children of the selected
// groups back on the flow (`node.set-parent` to `null`) and removes the groups, in one `batch`
// too: removing a group first would remove its children with it (grouping.vue).

export interface Types extends FlowTypes {
    readonly nodes: {
        group: { label: string };
        item: { label: string };
    };
}

export const features = [selection(), drag(), subflows()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "frontend",
        type: "group",
        position: { x: 0, y: 0 },
        width: 260,
        height: 220,
        data: { label: "Frontend" },
    },
    {
        id: "ui",
        type: "item",
        parentId: "frontend",
        extent: "parent",
        position: { x: 20, y: 50 },
        data: { label: "UI" },
    },
    {
        id: "state",
        type: "item",
        parentId: "frontend",
        extent: "parent",
        position: { x: 110, y: 140 },
        data: { label: "State" },
    },
    {
        id: "backend",
        type: "group",
        position: { x: 340, y: 0 },
        width: 260,
        height: 220,
        data: { label: "Backend" },
    },
    {
        id: "api",
        type: "item",
        parentId: "backend",
        extent: "parent",
        position: { x: 30, y: 60 },
        data: { label: "API" },
    },
    {
        id: "cache",
        type: "item",
        position: { x: 140, y: 280 },
        data: { label: "Cache (drop me in a group)" },
    },
    {
        id: "logs",
        type: "item",
        position: { x: 400, y: 280 },
        data: { label: "Logs" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "ui-state", source: "ui", target: "state" },
    { id: "state-api", source: "state", target: "api" },
];
</script>

<script setup lang="ts">
import { typedFlow } from "@fragiola/flow-vue";
import DropIntoGroups from "./drop-into-groups.vue";
import Grouping from "./grouping.vue";
import { styles } from "./styles";

const Flow = typedFlow<Types, typeof features>();
</script>

<template>
    <Flow.Root
        :features="features"
        :default-nodes="nodes"
        :default-edges="edges"
        :fit-view="{ padding: 0.2, maxZoom: 1 }"
        z-index-mode="auto"
        :class="styles.root"
    >
        <Flow.Background variant="dots" :size="2" :class="styles.dots" />
        <Flow.Background variant="lines" :class="styles.lines" />
        <Flow.Background variant="cross" :class="styles.cross" />
        <Flow.Viewport>
            <Flow.Edges v-slot="{ edge }">
                <Flow.Edge :edge="edge">
                    <Flow.EdgePath :class="styles.edge" />
                </Flow.Edge>
            </Flow.Edges>
            <Flow.Nodes v-slot="{ node }">
                <Flow.Node v-if="node.type === 'group'" :node="node" :class="styles.group">
                    <span :class="styles.groupTitle">{{ node.data.label }}</span>
                </Flow.Node>
                <Flow.Node v-else :node="node" :class="styles.node">
                    {{ node.data.label }}
                    <Flow.Handle type="target" side="top" :class="styles.handle" />
                    <Flow.Handle type="source" side="bottom" :class="styles.handle" />
                </Flow.Node>
            </Flow.Nodes>
        </Flow.Viewport>
        <DropIntoGroups />
        <Grouping />
    </Flow.Root>
</template>
