<script lang="ts">
import type {
    FlowEdge,
    FlowEdgeInput,
    FlowNodeInput,
    FlowTypes,
} from "@fragiola/flow-vue";
import { drag } from "@fragiola/flow-vue/drag";
import { selection } from "@fragiola/flow-vue/selection";

// An image of the flow, built from its document alone: `flowSvg` (flow-svg.ts) runs the core's
// static geometry (`staticGeometry`: node boxes from the declared sizes, edge paths from the path
// helpers) and writes a standalone SVG string, no DOM needed, so a server makes the same file (the
// unit test does, in node). Download SVG saves it; Download PNG draws it on a canvas and saves
// that. The file cannot read the page's CSS variables, so the theme's look is read off the drawn
// parts at click time and passed in as plain colours. The nodes declare their size and handles,
// so the document holds every box and edge end; drag them and export again.

export interface Types extends FlowTypes {
    readonly nodes: { step: { label: string } };
}

export const features = [selection(), drag()] as const;

const WIDTH = 140;
const HEIGHT = 48;

/** A node of the declared size, with an input on the left and an output on the right. */
function step(id: string, label: string, x: number, y: number) {
    return {
        id,
        type: "step",
        position: { x, y },
        width: WIDTH,
        height: HEIGHT,
        handles: [
            { type: "target", position: "left", x: 0, y: HEIGHT / 2 },
            { type: "source", position: "right", x: WIDTH, y: HEIGHT / 2 },
        ],
        data: { label },
    } satisfies FlowNodeInput<Types>;
}

const nodes: FlowNodeInput<Types>[] = [
    step("document", "Document", 0, 80),
    step("geometry", "Static geometry", 200, 0),
    step("paths", "Edge paths", 200, 160),
    step("svg", "SVG <string>", 400, 80),
    step("png", "PNG & canvas", 600, 80),
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "document-geometry", source: "document", target: "geometry" },
    {
        id: "document-paths",
        source: "document",
        target: "paths",
        type: "smoothstep",
    },
    { id: "geometry-svg", source: "geometry", target: "svg", type: "step" },
    { id: "paths-svg", source: "paths", target: "svg" },
    { id: "svg-png", source: "svg", target: "png", type: "straight" },
];

/** An edge's accessible name: "document to geometry". */
const edgeName = (edge: FlowEdge<Types>) => `${edge.source} to ${edge.target}`;
</script>

<script setup lang="ts">
import { typedFlow } from "@fragiola/flow-vue";
import ExportToolbar from "./export-toolbar.vue";
import { styles } from "./styles";

const Flow = typedFlow<Types, typeof features>();
</script>

<template>
    <Flow.Root
        :features="features"
        :default-nodes="nodes"
        :default-edges="edges"
        fit-view
        role="group"
        aria-label="Export image"
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
                    :aria-label="edgeName(edge)"
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
                    <div data-frame="" :class="styles.card">
                        {{ node.data.label }}
                    </div>
                    <Flow.Handle type="target" side="left" :class="styles.handle" />
                    <Flow.Handle type="source" side="right" :class="styles.handle" />
                </Flow.Node>
            </Flow.Nodes>
        </Flow.Viewport>
        <ExportToolbar />
    </Flow.Root>
</template>
