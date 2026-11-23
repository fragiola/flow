<script lang="ts">
import type { FlowJson, FlowTypes } from "@fragiola/flow-vue";
import { drag } from "@fragiola/flow-vue/drag";
import { keyboard } from "@fragiola/flow-vue/keyboard";
import { selection } from "@fragiola/flow-vue/selection";

// Helper lines: while a node is dragged alone, a guide is drawn wherever one of its edges or its
// centre lines up with another node's, and the node snaps onto those lines when it comes within
// `SNAP` flow units of them. The snap is a middleware (`snapping.ts`, `model.use`): it rewrites the
// position of the drag's `node.move` steps (run as `transient`) and of the drop, so the document
// only ever holds the snapped position. The guides are the example's own state, never the
// document's: a store (`useFlowStore`, helper-lines.vue) reads the dragged node
// (`dragging-node-ids`) and where it lines up now (`alignment.ts`), and draws them in flow
// coordinates inside the viewport; the drop ends the drag and clears them.

export interface Types extends FlowTypes {
    readonly nodes: { card: { label: string } };
}

export const features = [selection(), drag(), keyboard()] as const;

/** How near (flow units) a dragged node's line must come to another's to snap onto it. */
const SNAP = 8;

/** How far (flow units) a guide runs past the boxes it joins. */
export const OVERHANG = 12;

const card = (
    id: string,
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
) => ({
    id,
    type: "card" as const,
    position: { x, y },
    width,
    height,
    data: { label },
});

const json: FlowJson<Types> = {
    version: 1,
    nodes: [
        card("draft", "Draft", 0, 0, 160, 60),
        card("review", "Review", 280, 110, 120, 80),
        card("publish", "Publish", 36, 250, 180, 60),
    ],
    edges: [
        { id: "draft-review", source: "draft", target: "review" },
        { id: "review-publish", source: "review", target: "publish" },
    ],
};

/** The node's labels, for the edges' names. */
const LABELS: Record<string, string> = Object.fromEntries(
    json.nodes.map((node) => [node.id, node.data.label]),
);

const labelOf = (id: string) => LABELS[id] ?? id;

/** A position as the node prints it: a tenth at most. */
const printed = (value: number) => Number(value.toFixed(1));
</script>

<script setup lang="ts">
import { createFlowModel, typedFlow } from "@fragiola/flow-vue";
import HelperLines from "./helper-lines.vue";
import { snapToLines } from "./snapping";
import { styles } from "./styles";

const Flow = typedFlow<Types, typeof features>();

// the model is made once, with the snap as its middleware, and handed to the root
const model = createFlowModel<Types, typeof features>(json, { features });
model.use(snapToLines(SNAP));
</script>

<template>
    <Flow.Root
        :model="model"
        :fit-view="{ padding: 0.2, maxZoom: 1 }"
        role="group"
        aria-label="Helper lines"
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
                    :aria-label="`${labelOf(edge.source)} to ${labelOf(edge.target)}`"
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
                    <span data-testid="position" :class="styles.position">
                        {{ printed(node.position.x) }}, {{ printed(node.position.y) }}
                    </span>
                    <Flow.Handle type="source" side="right" :class="styles.handle" />
                </Flow.Node>
            </Flow.Nodes>
            <HelperLines />
        </Flow.Viewport>
        <p :class="styles.hint">
            Drag a node until its edges or centre line up with another one
        </p>
    </Flow.Root>
</template>
