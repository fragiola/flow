<script lang="ts">
import type {
    FlowEdgeInput,
    FlowNodeInput,
    FlowTypes,
} from "@fragiola/flow-vue";
import { connection } from "@fragiola/flow-vue/connection";
import { drag } from "@fragiola/flow-vue/drag";
import { selection } from "@fragiola/flow-vue/selection";

// The smallest flow: four nodes and three edges. The root fills its frame (give it a size); the
// background sits behind the viewport, and inside it the edges come before the nodes so the nodes
// are drawn on top. Pan by dragging the canvas, zoom with the wheel or a pinch, drag a node, and
// draw an edge from a node's bottom handle to another node's top handle.

interface Types extends FlowTypes {
    readonly nodes: { step: { label: string } };
}

const features = [selection(), drag(), connection()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "start",
        type: "step",
        position: { x: 0, y: 0 },
        data: { label: "Start" },
    },
    {
        id: "fetch",
        type: "step",
        position: { x: -160, y: 140 },
        data: { label: "Fetch data" },
    },
    {
        id: "parse",
        type: "step",
        position: { x: 160, y: 140 },
        data: { label: "Parse file" },
    },
    {
        id: "save",
        type: "step",
        position: { x: 0, y: 280 },
        data: { label: "Save" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "start-fetch", source: "start", target: "fetch" },
    { id: "start-parse", source: "start", target: "parse" },
    { id: "fetch-save", source: "fetch", target: "save" },
];
</script>

<script setup lang="ts">
import { typedFlow } from "@fragiola/flow-vue";
import { styles } from "./styles";

// the primitives typed by this flow's registry and features (a template takes no type argument)
const Flow = typedFlow<Types, typeof features>();
</script>

<template>
    <Flow.Root
        :features="features"
        :default-nodes="nodes"
        :default-edges="edges"
        :fit-view="{ padding: 0.2, maxZoom: 1 }"
        :class="styles.root"
    >
        <!-- one layer per pattern: the theme shows the one it picks -->
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
                <Flow.Node :node="node" :class="styles.node">
                    {{ node.data.label }}
                    <Flow.Handle type="target" side="top" :class="styles.handle" />
                    <Flow.Handle type="source" side="bottom" :class="styles.handle" />
                </Flow.Node>
            </Flow.Nodes>
            <Flow.ConnectionLine :class="styles.connection" />
        </Flow.Viewport>
    </Flow.Root>
</template>
