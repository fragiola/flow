<script lang="ts">
import type { FlowEdgeInput, FlowNodeInput, FlowTypes } from "@fragiola/flow-vue";
import { drag } from "@fragiola/flow-vue/drag";
import { keyboard } from "@fragiola/flow-vue/keyboard";
import { selection } from "@fragiola/flow-vue/selection";

// A whiteboard: a toolbar of tools over the flow. "Select" is the flow as usual (pan, drag,
// select). Every other tool lays a drawing layer over the flow that takes the pointer
// (`data-flow-no-gesture`: the engine leaves its presses alone) and turns its client points into
// flow coordinates (`screen-to-flow`); the pane's pan is off meanwhile (`:pan-on-drag`).
// "Rectangle" adds a node of the dragged box; "Freehand" smooths the pointer's points into a path
// (`stroke.ts`) and saves it as a node of its own, placed at the stroke's top-left corner with the
// path relative to it; "Eraser" removes the nodes and edges the pointer wipes over (`eraser.ts`),
// in one `batch` per wipe; "Lasso" selects the nodes wholly inside the shape it draws
// (`lasso.ts`, `selection.set`). The active tool is on the root (`data-tool`).

export interface Types extends FlowTypes {
    readonly nodes: {
        shape: { label: string };
        stroke: { label: string; d: string };
    };
}

export const features = [selection(), drag(), keyboard()] as const;

export type Tool = "select" | "rectangle" | "freehand" | "eraser" | "lasso";

const shape = (
    id: string,
    label: string,
    x: number,
    y: number,
): FlowNodeInput<Types> => ({
    id,
    type: "shape",
    position: { x, y },
    width: 130,
    height: 70,
    data: { label },
});

const nodes: FlowNodeInput<Types>[] = [
    shape("ideas", "Ideas", 0, 0),
    shape("sketch", "Sketch", 240, 0),
    shape("review", "Review", 480, 0),
    shape("notes", "Notes", 120, 200),
    {
        id: "underline",
        type: "stroke",
        position: { x: 316, y: 216 },
        width: 168,
        height: 28,
        data: {
            label: "Squiggle",
            d: "M4,14 L30,6 L56,20 L82,6 L108,20 L134,6 L164,14",
        },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "ideas-sketch", source: "ideas", target: "sketch", type: "straight" },
    {
        id: "sketch-review",
        source: "sketch",
        target: "review",
        type: "straight",
    },
];

const LABELS: Record<string, string> = Object.fromEntries(
    nodes.map((node) => [node.id, node.data.label]),
);
</script>

<script setup lang="ts">
import { typedFlow } from "@fragiola/flow-vue";
import { ref, shallowRef } from "vue";
import DrawingLayer from "./drawing-layer.vue";
import { styles } from "./styles";
import Toolbar from "./toolbar.vue";

const Flow = typedFlow<Types, typeof features>();
const tool = ref<Tool>("select");
/** The ids the eraser's current wipe has touched: marked until it ends, then removed. */
const erasing = shallowRef<ReadonlySet<string>>(new Set());
const status = ref("");

const marked = (id: string) => (erasing.value.has(id) ? "" : undefined);
</script>

<template>
    <!-- a drawing tool's press draws: the pane does not pan under it -->
    <Flow.Root
        :features="features"
        :default-nodes="nodes"
        :default-edges="edges"
        :fit-view="{ padding: 0.25, maxZoom: 1 }"
        :pan-on-drag="tool === 'select'"
        role="group"
        aria-label="Whiteboard"
        :data-tool="tool"
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
                    :aria-label="`${LABELS[edge.source]} to ${LABELS[edge.target]}`"
                    :data-erasing="marked(edge.id)"
                    :class="styles.edgeGroup"
                >
                    <Flow.EdgePath :class="styles.edge" />
                </Flow.Edge>
            </Flow.Edges>
            <Flow.Nodes v-slot="{ node }">
                <Flow.Node
                    v-if="node.type === 'stroke'"
                    :node="node"
                    role="group"
                    aria-roledescription="stroke"
                    :aria-label="node.data.label"
                    :data-erasing="marked(node.id)"
                    :class="styles.stroke"
                >
                    <svg aria-hidden="true" :class="styles.strokeSvg">
                        <path :d="node.data.d" :class="styles.strokePath" />
                    </svg>
                </Flow.Node>
                <Flow.Node
                    v-else
                    :node="node"
                    role="group"
                    aria-roledescription="rectangle"
                    :aria-label="node.data.label"
                    :data-erasing="marked(node.id)"
                    :class="styles.shape"
                >
                    {{ node.data.label }}
                    <Flow.Handle type="target" side="left" :class="styles.handle" />
                    <Flow.Handle type="source" side="right" :class="styles.handle" />
                </Flow.Node>
            </Flow.Nodes>
        </Flow.Viewport>
        <Flow.SelectionBox :class="styles.selectionBox" />
        <DrawingLayer
            v-if="tool !== 'select'"
            :tool="tool"
            @erasing="erasing = $event"
            @status="status = $event"
        />
        <Toolbar :tool="tool" :status="status" @tool="tool = $event" />
    </Flow.Root>
</template>
