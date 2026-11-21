<script lang="ts">
import type {
    FlowEdgeInput,
    FlowNodeInput,
    FlowTypes,
} from "@fragiola/flow-vue";
import { drag } from "@fragiola/flow-vue/drag";
import { keyboard } from "@fragiola/flow-vue/keyboard";
import { selection } from "@fragiola/flow-vue/selection";

// `selection()` selects with a click, adds with Shift (or Ctrl/Cmd) and draws a box with Shift and
// a drag on the canvas; `keyboard()` makes nodes and edges focusable: Tab moves through them,
// Enter or Space selects, the arrows move the selection (Shift for a bigger step), Delete removes
// it and Escape clears it. The package names nothing: each node and edge gets its name here.

export interface Types extends FlowTypes {
    readonly nodes: { task: { label: string } };
}

const features = [selection(), drag(), keyboard()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "design",
        type: "task",
        position: { x: 0, y: 0 },
        data: { label: "Design" },
    },
    {
        id: "build",
        type: "task",
        position: { x: 220, y: 0 },
        data: { label: "Build" },
    },
    {
        id: "review",
        type: "task",
        position: { x: 440, y: 0 },
        data: { label: "Review" },
    },
    {
        id: "docs",
        type: "task",
        position: { x: 220, y: 150 },
        data: { label: "Docs" },
    },
    {
        id: "ship",
        type: "task",
        position: { x: 440, y: 150 },
        data: { label: "Ship" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "design-build", source: "design", target: "build" },
    { id: "build-review", source: "build", target: "review" },
    { id: "build-docs", source: "build", target: "docs" },
    { id: "review-ship", source: "review", target: "ship" },
    { id: "docs-ship", source: "docs", target: "ship" },
];
</script>

<script setup lang="ts">
import { typedFlow } from "@fragiola/flow-vue";
import SelectionStatus from "./selection-status.vue";
import { styles } from "./styles";

const Flow = typedFlow<Types, typeof features>();
</script>

<template>
    <Flow.Root
        :features="features"
        :default-nodes="nodes"
        :default-edges="edges"
        :fit-view="{ padding: 0.2, maxZoom: 1 }"
        role="group"
        aria-label="Release plan"
        :class="styles.root"
    >
        <Flow.Background variant="dots" :size="2" :class="styles.dots" />
        <Flow.Background variant="lines" :class="styles.lines" />
        <Flow.Background variant="cross" :class="styles.cross" />
        <Flow.Viewport>
            <Flow.Edges v-slot="{ edge }">
                <Flow.Edge
                    :edge="edge"
                    role="group"
                    aria-roledescription="edge"
                    :aria-label="`${edge.source} to ${edge.target}`"
                    :class="styles.edgeGroup"
                >
                    <!-- a wide transparent path: a bigger target for a click -->
                    <Flow.EdgePath :class="styles.edgeHit" />
                    <Flow.EdgePath :class="styles.edge" />
                </Flow.Edge>
            </Flow.Edges>
            <Flow.Nodes v-slot="{ node }">
                <Flow.Node
                    :node="node"
                    role="group"
                    aria-roledescription="node"
                    :aria-label="node.data.label"
                    :class="styles.node"
                >
                    {{ node.data.label }}
                    <Flow.Handle type="target" side="left" :class="styles.handle" />
                    <Flow.Handle type="source" side="right" :class="styles.handle" />
                </Flow.Node>
            </Flow.Nodes>
        </Flow.Viewport>
        <Flow.SelectionBox :class="styles.box" />
        <SelectionStatus />
        <p :class="styles.hint">
            Shift + drag draws a box · Tab, arrows, Delete, Escape
        </p>
    </Flow.Root>
</template>
