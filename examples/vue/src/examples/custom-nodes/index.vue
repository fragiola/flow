<script lang="ts">
import type {
    FlowEdgeInput,
    FlowNode,
    FlowNodeInput,
    FlowTypes,
} from "@fragiola/flow-vue";
import { connection } from "@fragiola/flow-vue/connection";
import { drag } from "@fragiola/flow-vue/drag";
import { selection } from "@fragiola/flow-vue/selection";

// Each node type renders its own content from its typed data. The `Types` registry names the node
// types and their data, so `node.type` narrows `node.data`. The colour and number nodes write their
// data with `node.set-data`; the preview reads the nodes wired into its two target handles. A field
// inside a node keeps its own presses: it never starts a drag. Each node type is a component of
// its own (colour-node.vue, number-node.vue, preview-node.vue).

export interface Types extends FlowTypes {
    readonly nodes: {
        colour: { label: string; colour: string };
        number: { label: string; value: number };
        preview: { label: string };
    };
}

export type Node = FlowNode<Types>;

export const features = [selection(), drag(), connection()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "colour",
        type: "colour",
        position: { x: 0, y: 0 },
        data: { label: "Colour", colour: "#3b82f6" },
    },
    {
        id: "size",
        type: "number",
        position: { x: 0, y: 160 },
        data: { label: "Size", value: 48 },
    },
    {
        id: "preview",
        type: "preview",
        position: { x: 320, y: 50 },
        data: { label: "Preview" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    {
        id: "colour-preview",
        source: "colour",
        target: "preview",
        targetHandle: "colour",
    },
    {
        id: "size-preview",
        source: "size",
        target: "preview",
        targetHandle: "size",
    },
];
</script>

<script setup lang="ts">
import { typedFlow } from "@fragiola/flow-vue";
import ColourNode from "./colour-node.vue";
import NumberNode from "./number-node.vue";
import PreviewNode from "./preview-node.vue";
import { styles } from "./styles";

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
                    <ColourNode v-if="node.type === 'colour'" :node="node" />
                    <NumberNode v-else-if="node.type === 'number'" :node="node" />
                    <PreviewNode v-else-if="node.type === 'preview'" :node="node" />
                </Flow.Node>
            </Flow.Nodes>
            <Flow.ConnectionLine :class="styles.connection" />
        </Flow.Viewport>
    </Flow.Root>
</template>
