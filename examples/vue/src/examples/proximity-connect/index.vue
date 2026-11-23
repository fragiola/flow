<script lang="ts">
import type {
    FlowEngine,
    FlowJson,
    FlowModel,
    FlowTypes,
} from "@fragiola/flow-vue";
import { drag } from "@fragiola/flow-vue/drag";
import { keyboard } from "@fragiola/flow-vue/keyboard";
import { selection } from "@fragiola/flow-vue/selection";
import { type Link, type Placed, proximityLink } from "./proximity";

// Connecting by proximity: drag a node near another and a dashed line shows the edge it would
// make, to the closest node within `MAX_GAP` (flow units between the two boxes) that it is not
// joined to yet; drop it there and the edge is added. The dashed line is the example's own state,
// never the document's: `drag-start` (`@node-drag-start`) says which node is dragged, a store
// (`useFlowStore`, temporary-edge.vue) reads every node's box (`engine.get("node-rect-by")`) while
// it moves and keeps the closest one, and the drop (`nodes-move`, `@nodes-move`) runs `edge.add`
// when there is one. The geometry is framework-free, in `proximity.ts`.

export interface Types extends FlowTypes {
    readonly nodes: { step: { label: string } };
}

export const features = [selection(), drag(), keyboard()] as const;

/** How close (flow units of empty space between two nodes) a drop must be to connect. */
const MAX_GAP = 80;

const step = (id: string, label: string, x: number, y: number) => ({
    id,
    type: "step" as const,
    position: { x, y },
    width: 140,
    height: 56,
    data: { label },
});

const json: FlowJson<Types> = {
    version: 1,
    nodes: [
        step("fetch", "Fetch", 0, 0),
        step("parse", "Parse", 320, 0),
        step("store", "Store", 640, 0),
        step("notify", "Notify", 160, 280),
        step("log", "Log", 480, 280),
    ],
    edges: [{ id: "fetch-parse", source: "fetch", target: "parse" }],
};

/** The node's labels, for the edges' names. */
const LABELS: Record<string, string> = Object.fromEntries(
    json.nodes.map((node) => [node.id, node.data.label]),
);

/** The edge a dragged node would make now, from every node's box on screen, or none. */
export function linkFor(
    model: FlowModel<Types, typeof features>,
    engine: FlowEngine<Types, typeof features>,
    nodeId: string,
): Link | undefined {
    const placed: Placed[] = [];
    for (const node of model.get("all-nodes")) {
        const box = engine.get("node-rect-by", { nodeId: node.id });
        if (box && box.width > 0) placed.push({ id: node.id, box });
    }
    const dragged = placed.find((item) => item.id === nodeId);
    if (!dragged) return undefined;
    return proximityLink(dragged, placed, model.get("all-edges"), MAX_GAP);
}
</script>

<script setup lang="ts">
import {
    type FlowEngineEventOf,
    typedFlow,
    useFlowRef,
} from "@fragiola/flow-vue";
import { ref } from "vue";
import { styles } from "./styles";
import TemporaryEdge from "./temporary-edge.vue";

const Flow = typedFlow<Types, typeof features>();
const flow = useFlowRef<Types, typeof features>();
// the node being dragged alone, while it is: app state, never the document's
const dragged = ref<string>();

function onNodeDragStart(event: FlowEngineEventOf<"drag-start">) {
    dragged.value = event.nodeIds.length === 1 ? event.nodeIds[0] : undefined;
}

/** The drop: the edge the temporary line showed, if any, becomes a real one. */
function onNodesMove(event: FlowEngineEventOf<"nodes-move">) {
    const nodeId = dragged.value;
    dragged.value = undefined;
    const current = flow.value;
    if (!current || event.source !== "pointer" || nodeId === undefined) return;
    const link = linkFor(current.model, current.engine, nodeId);
    if (!link) return;
    current.model.run("edge.add", {
        id: `${link.source}-${link.target}`,
        source: link.source,
        target: link.target,
    });
}
</script>

<template>
    <Flow.Root
        :features="features"
        :default-nodes="json.nodes"
        :default-edges="json.edges"
        :fit-view="{ padding: 0.2, maxZoom: 1 }"
        :flow-ref="flow"
        role="group"
        aria-label="Proximity connect"
        :class="styles.root"
        @node-drag-start="onNodeDragStart"
        @nodes-move="onNodesMove"
        @node-drag-cancel="dragged = undefined"
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
                    :aria-label="`${LABELS[edge.source] ?? edge.source} to ${LABELS[edge.target] ?? edge.target}`"
                    :class="styles.edgeGroup"
                >
                    <Flow.EdgePath :class="styles.edge" />
                </Flow.Edge>
            </Flow.Edges>
            <TemporaryEdge v-if="dragged !== undefined" :node-id="dragged" />
            <Flow.Nodes v-slot="{ node }">
                <Flow.Node
                    :node="node"
                    role="group"
                    aria-roledescription="node"
                    :aria-label="node.data.label"
                    :class="styles.node"
                >
                    <Flow.Handle type="target" side="left" :class="styles.handle" />
                    {{ node.data.label }}
                    <Flow.Handle type="source" side="right" :class="styles.handle" />
                </Flow.Node>
            </Flow.Nodes>
        </Flow.Viewport>
        <p :class="styles.hint">
            Drag a node close to another one and drop it to connect them
        </p>
    </Flow.Root>
</template>
