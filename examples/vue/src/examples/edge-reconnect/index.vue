<script lang="ts">
import type {
    FlowEdgeInput,
    FlowEngineEventOf,
    FlowNodeInput,
    FlowTypes,
} from "@fragiola/flow-vue";
import { connection } from "@fragiola/flow-vue/connection";
import { drag } from "@fragiola/flow-vue/drag";
import { reconnection } from "@fragiola/flow-vue/reconnection";
import { selection } from "@fragiola/flow-vue/selection";

// `reconnection()` (it needs `connection()`) lets an edge's end move: press a `Flow.ReconnectAnchor`
// (drawn here as a ring at each end) or the stroke near an end, and drop it on another handle. The
// edge keeps its id (`edge.reconnect`); dropped nowhere or on a refused handle, it goes back. The
// "locked" edge is not reconnectable (`reconnectable: false`).
//
// "Delete on drop" is app policy over the `reconnect-cancel` event (`@reconnect-cancel`): an end
// released over no handle (`dropped`, no `to`, not `refused`) removes its edge with `edge.remove`.

interface Types extends FlowTypes {
    readonly nodes: { device: { label: string } };
}

const features = [selection(), drag(), connection(), reconnection()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "router",
        type: "device",
        position: { x: 0, y: 100 },
        data: { label: "Router" },
    },
    {
        id: "laptop",
        type: "device",
        position: { x: 300, y: 0 },
        data: { label: "Laptop" },
    },
    {
        id: "printer",
        type: "device",
        position: { x: 300, y: 120 },
        data: { label: "Printer" },
    },
    {
        id: "tv",
        type: "device",
        position: { x: 300, y: 240 },
        data: { label: "TV" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "router-laptop", source: "router", target: "laptop" },
    { id: "router-tv", source: "router", target: "tv", reconnectable: false },
];
</script>

<script setup lang="ts">
import { typedFlow, useFlowRef } from "@fragiola/flow-vue";
import { ref } from "vue";
import { styles } from "./styles";

const Flow = typedFlow<Types, typeof features>();
const flow = useFlowRef<Types, typeof features>();
const deleteOnDrop = ref(false);

/** An end dropped on the pane, with "Delete on drop" on: the edge goes. */
function onReconnectCancel(event: FlowEngineEventOf<"reconnect-cancel">) {
    if (!deleteOnDrop.value || !event.dropped || event.to || event.refused) {
        return;
    }
    flow.value?.model.run("edge.remove", { edgeId: event.edgeId });
}
</script>

<template>
    <Flow.Root
        :features="features"
        :default-nodes="nodes"
        :default-edges="edges"
        :fit-view="{ padding: 0.2, maxZoom: 1 }"
        :flow-ref="flow"
        :class="styles.root"
        @reconnect-cancel="onReconnectCancel"
    >
        <Flow.Background variant="dots" :size="2" :class="styles.dots" />
        <Flow.Background variant="lines" :class="styles.lines" />
        <Flow.Background variant="cross" :class="styles.cross" />
        <Flow.Viewport>
            <Flow.Edges v-slot="{ edge }">
                <Flow.Edge :edge="edge" :class="styles.edgeGroup">
                    <Flow.EdgePath :class="styles.edge" />
                    <Flow.EdgeLabel
                        v-if="edge.reconnectable === false"
                        :class="styles.label"
                    >
                        locked
                    </Flow.EdgeLabel>
                    <template v-else>
                        <Flow.ReconnectAnchor end="source" :class="styles.anchor" />
                        <Flow.ReconnectAnchor end="target" :class="styles.anchor" />
                    </template>
                </Flow.Edge>
            </Flow.Edges>
            <Flow.Nodes v-slot="{ node }">
                <Flow.Node :node="node" :class="styles.node">
                    {{ node.data.label }}
                    <Flow.Handle type="target" side="left" :class="styles.handle" />
                    <Flow.Handle type="source" side="right" :class="styles.handle" />
                </Flow.Node>
            </Flow.Nodes>
            <Flow.ConnectionLine :class="styles.connection" />
        </Flow.Viewport>
        <label data-flow-no-gesture :class="styles.option">
            <input
                v-model="deleteOnDrop"
                type="checkbox"
                role="switch"
                :aria-checked="deleteOnDrop"
                :class="styles.switch"
            />
            Delete on drop
        </label>
    </Flow.Root>
</template>
