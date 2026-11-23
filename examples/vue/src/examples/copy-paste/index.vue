<script lang="ts">
import type {
    FlowEdge,
    FlowEdgeInput,
    FlowNodeInput,
    FlowTypes,
    XY,
} from "@fragiola/flow-vue";
import { drag } from "@fragiola/flow-vue/drag";
import { keyboard } from "@fragiola/flow-vue/keyboard";
import { selection } from "@fragiola/flow-vue/selection";

// Copy and paste: Ctrl/⌘ + C copies the selected nodes and the edges between them, Ctrl/⌘ + X
// cuts them (`selection.remove`), Ctrl/⌘ + V pastes them with new ids in one `batch` that also
// selects them; the toolbar's buttons do the same. The keys are read with `useKeyPress` (the
// library's own shortcuts use no Ctrl/⌘ + C, X or V). A paste goes under the pointer when it is
// over the flow (`screen-to-flow`), and each paste at the same place moves one step further. The
// clipboard is JSON with a marker (`clipboard.ts`): it is written to the system clipboard when the
// browser allows it, so another tab of this example can paste it, and kept in memory as well, for
// when reading the system clipboard is refused or it holds someone else's text.

export interface Types extends FlowTypes {
    readonly nodes: { step: { label: string } };
    readonly edges: { bezier: { name: string } };
}

export const features = [selection(), drag(), keyboard()] as const;

/** Where the pointer is over the flow (client coordinates), for a paste under it. */
export interface PointerRef {
    current: XY | undefined;
}

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "idea",
        type: "step",
        position: { x: 0, y: 0 },
        data: { label: "Idea" },
    },
    {
        id: "sketch",
        type: "step",
        position: { x: 200, y: 0 },
        data: { label: "Sketch" },
    },
    {
        id: "build",
        type: "step",
        position: { x: 400, y: 0 },
        data: { label: "Build" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    {
        id: "idea-sketch",
        source: "idea",
        target: "sketch",
        data: { name: "Idea to Sketch" },
    },
    {
        id: "sketch-build",
        source: "sketch",
        target: "build",
        data: { name: "Sketch to Build" },
    },
];

/** The edge's name: its own, or its ends'. */
function edgeName(edge: FlowEdge<Types>) {
    const name = edge.data?.name;
    return typeof name === "string" ? name : `${edge.source} to ${edge.target}`;
}
</script>

<script setup lang="ts">
import { typedFlow } from "@fragiola/flow-vue";
import ClipboardToolbar from "./clipboard-toolbar.vue";
import { styles } from "./styles";

const Flow = typedFlow<Types, typeof features>();

// where the pointer is over the flow (client coordinates), for a paste under it; read on a paste,
// never rendered
const pointer: PointerRef = { current: undefined };

function onPointerMove(event: PointerEvent) {
    const overToolbar =
        event.target instanceof Element &&
        event.target.closest('[role="toolbar"]') !== null;
    pointer.current = overToolbar
        ? undefined
        : { x: event.clientX, y: event.clientY };
}

function onPointerLeave() {
    pointer.current = undefined;
}
</script>

<template>
    <Flow.Root
        :features="features"
        :default-nodes="nodes"
        :default-edges="edges"
        :fit-view="{ padding: 0.3, maxZoom: 1 }"
        role="group"
        aria-label="Copy and paste"
        :class="styles.root"
        @pointermove="onPointerMove"
        @pointerleave="onPointerLeave"
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
                    :aria-label="edgeName(edge)"
                    :class="styles.edgeGroup"
                >
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
                    <Flow.Handle type="target" side="left" :class="styles.handle" />
                    {{ node.data.label }}
                    <Flow.Handle type="source" side="right" :class="styles.handle" />
                </Flow.Node>
            </Flow.Nodes>
        </Flow.Viewport>
        <ClipboardToolbar :pointer="pointer" />
        <p :class="styles.hint">
            Click or Shift-click nodes · Ctrl/⌘ + C, X, V · a paste goes under the pointer
        </p>
    </Flow.Root>
</template>
