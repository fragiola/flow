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

// A node that computes from its inputs: the sum node reads the connections that end at it
// (`useNodeConnections`) and their source nodes' data (`useNodesData`), so it follows a value
// changed with the steppers and an edge connected or removed, and renders again only then (a drag
// of another node does not touch it). Connect the third number to the sum to add it. Each body is a
// component of its own (number-body.vue, sum-body.vue).

export interface Types extends FlowTypes {
    readonly nodes: {
        number: { label: string; value: number };
        sum: { label: string };
    };
}

export type Node = FlowNode<Types>;

export const features = [selection(), drag(), connection()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "a",
        type: "number",
        position: { x: 0, y: 0 },
        data: { label: "A", value: 3 },
    },
    {
        id: "b",
        type: "number",
        position: { x: 0, y: 130 },
        data: { label: "B", value: 5 },
    },
    {
        id: "c",
        type: "number",
        position: { x: 0, y: 260 },
        data: { label: "C", value: 8 },
    },
    {
        id: "sum",
        type: "sum",
        position: { x: 300, y: 110 },
        data: { label: "Sum" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "a-sum", source: "a", target: "sum" },
    { id: "b-sum", source: "b", target: "sum" },
];
</script>

<script setup lang="ts">
import { typedFlow } from "@fragiola/flow-vue";
import NumberBody from "./number-body.vue";
import { styles } from "./styles";
import SumBody from "./sum-body.vue";

const Flow = typedFlow<Types, typeof features>();
</script>

<template>
    <Flow.Root
        :features="features"
        :default-nodes="nodes"
        :default-edges="edges"
        :fit-view="{ padding: 0.2, maxZoom: 1 }"
        role="group"
        aria-label="A sum of numbers"
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
                <Flow.Node
                    :node="node"
                    role="group"
                    aria-roledescription="node"
                    :aria-label="node.data.label"
                    :class="styles.node"
                >
                    <template v-if="node.type === 'number'">
                        <NumberBody :node="node" />
                        <Flow.Handle
                            type="source"
                            side="right"
                            :aria-label="`${node.data.label} output`"
                            :class="styles.handle"
                        />
                    </template>
                    <template v-else>
                        <SumBody />
                        <Flow.Handle
                            type="target"
                            side="left"
                            aria-label="Sum input"
                            :class="styles.handle"
                        />
                    </template>
                </Flow.Node>
            </Flow.Nodes>
            <Flow.ConnectionLine :class="styles.connection" />
        </Flow.Viewport>
        <p :class="styles.hint">Change a number, or connect C to the sum</p>
    </Flow.Root>
</template>
