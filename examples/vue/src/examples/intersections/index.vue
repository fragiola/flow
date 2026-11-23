<script lang="ts">
import type { FlowJson, FlowTypes } from "@fragiola/flow-vue";
import { drag } from "@fragiola/flow-vue/drag";
import { keyboard } from "@fragiola/flow-vue/keyboard";
import { selection } from "@fragiola/flow-vue/selection";

// While nodes are dragged, what they run into is marked `data-intersecting`: the nodes they
// overlap (`engine.get("intersecting-nodes", { nodeId })`, the engine's own test) and the edges
// whose path crosses them (`edge-path-by`'s path against the dragged node's `node-rect-by`, in
// `crossing.ts`). Each node and edge reads it from a store (`useFlowStore`) over the nodes being
// dragged (`dragging-node-ids`), so the marks follow the drag and clear on the drop.
//
// "Resolve collisions" is app policy over the drop (`nodes-move`, `@nodes-move`): the dropped
// nodes stay, and the nodes they overlap are pushed away until none does (`collisions.ts`), every
// move in one `batch`: one step, one undo.

export interface Types extends FlowTypes {
    readonly nodes: { step: { label: string } };
}

export const features = [selection(), drag(), keyboard()] as const;

/** The empty space (flow units) the resolver keeps between two nodes. */
const MARGIN = 16;

const step = (id: string, label: string, x: number, y: number) => ({
    id,
    type: "step" as const,
    position: { x, y },
    width: 140,
    height: 56,
    data: { label },
});

const link = (source: string, target: string) => ({
    id: `${source}-${target}`,
    source,
    target,
});

const json: FlowJson<Types> = {
    version: 1,
    nodes: [
        step("fetch", "Fetch", 0, 0),
        step("store", "Store", 520, 0),
        step("parse", "Parse", 260, 160),
        step("index", "Index", 520, 160),
        step("notify", "Notify", 0, 320),
        step("log", "Log", 260, 320),
    ],
    edges: [
        link("fetch", "store"),
        link("parse", "index"),
        link("notify", "log"),
    ],
};

/** The node's labels, for the edges' names. */
const LABELS: Record<string, string> = Object.fromEntries(
    json.nodes.map((node) => [node.id, node.data.label]),
);

export const labelOf = (id: string) => LABELS[id] ?? id;
</script>

<script setup lang="ts">
import {
    type FlowEngineEventOf,
    typedFlow,
    useFlowRef,
} from "@fragiola/flow-vue";
import { ref } from "vue";
import { type Placed, resolveCollisions } from "./collisions";
import LinkEdge from "./link-edge.vue";
import StepNode from "./step-node.vue";
import { styles } from "./styles";

const Flow = typedFlow<Types, typeof features>();
const flow = useFlowRef<Types, typeof features>();
const resolve = ref(false);

/** A drop with "Resolve collisions" on: the dropped nodes stay, the others make room. */
function onNodesMove(event: FlowEngineEventOf<"nodes-move">) {
    const current = flow.value;
    if (!resolve.value || !current || event.source !== "pointer") return;
    const placed: Placed[] = [];
    for (const node of current.model.get("all-nodes")) {
        const box = current.engine.get("node-rect-by", { nodeId: node.id });
        if (box && box.width > 0) placed.push({ id: node.id, box });
    }
    const moved = resolveCollisions(placed, {
        fixed: event.nodeIds,
        margin: MARGIN,
    });
    if (moved.length === 0) return;
    current.model.run("batch", {
        commands: moved.map(({ id, position }) => ({
            command: "node.move" as const,
            payload: { nodeId: id, position },
        })),
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
        aria-label="Intersections"
        :class="styles.root"
        @nodes-move="onNodesMove"
    >
        <Flow.Background variant="dots" :size="2" :class="styles.dots" />
        <Flow.Background variant="lines" :class="styles.lines" />
        <Flow.Background variant="cross" :class="styles.cross" />
        <Flow.Viewport>
            <Flow.Edges v-slot="{ edge }">
                <LinkEdge :edge="edge" />
            </Flow.Edges>
            <Flow.Nodes v-slot="{ node }">
                <StepNode :node="node" />
            </Flow.Nodes>
        </Flow.Viewport>
        <label data-flow-no-gesture :class="styles.option">
            <input
                v-model="resolve"
                type="checkbox"
                role="switch"
                :aria-checked="resolve"
                :class="styles.switch"
            />
            Resolve collisions
        </label>
        <p :class="styles.hint">Drag a node over another one or across an edge</p>
    </Flow.Root>
</template>
