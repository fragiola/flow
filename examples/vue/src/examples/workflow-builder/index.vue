<script lang="ts">
import { connection } from "@fragiola/flow-vue/connection";
import { drag } from "@fragiola/flow-vue/drag";
import { keyboard } from "@fragiola/flow-vue/keyboard";
import { minimap } from "@fragiola/flow-vue/minimap";
import { reconnection } from "@fragiola/flow-vue/reconnection";
import { selection } from "@fragiola/flow-vue/selection";

// An automation editor built from the primitives: a palette of typed steps (drag one in, or click
// it), custom nodes with typed ports, connection rules as a middleware (a refused port turns red
// while you drag), a condition's two branches labelled on their edges, the inspector of the
// selected step, a minimap and the zoom controls. The palette and the inspector sit beside the
// root and work on the same model.

const features = [
    selection(),
    drag({ snapGrid: [10, 10] }),
    connection(),
    reconnection(),
    keyboard(),
    minimap(),
] as const;

type Features = typeof features;

let added = 0;
</script>

<script setup lang="ts">
import {
    createFlowModel,
    type FlowModel,
    typedFlow,
    useFlowRef,
} from "@fragiola/flow-vue";
import { MiniMap, MiniMapMask, MiniMapNode } from "@fragiola/flow-vue/minimap";
import { MaximizeIcon, MinusIcon, PlusIcon, WorkflowIcon } from "@lucide/vue";
import { computed } from "vue";
import { Badge } from "#/components/atoms/badge";
import { CATALOG, type CatalogEntry } from "./catalog";
import { initialWorkflow } from "./data";
import Inspector from "./inspector.vue";
import Palette, { STEP_MIME } from "./palette.vue";
import { issuesOf, workflowRules } from "./rules";
import StepNode from "./step-node.vue";
import { styles } from "./styles";
import type { Types } from "./types";
import { useWorkflow } from "./use-workflow";

const Flow = typedFlow<Types, Features>();

// the model is made here, once, so that the panels beside the root work on it too
const model: FlowModel<Types, Features> = createFlowModel<Types, Features>(
    initialWorkflow,
    { features },
);
model.use(workflowRules);
// every connection is drawn as a smooth step, like the workflow's own
model.use((ctx, next) => {
    if (ctx.command === "edge.add") {
        ctx.payload = { ...ctx.payload, type: "smoothstep" };
    }
    return next();
});
const flow = useFlowRef<Types, Features>();

// the header's status: how many issues the workflow has left
const { steps, edges } = useWorkflow(model);
const count = computed(() =>
    steps.value.reduce(
        (sum, step) => sum + issuesOf(step, edges.value).length,
        0,
    ),
);

/** Adds a step centred on a client point (a drop's, or the canvas' centre). */
function addStep(entry: CatalogEntry, client?: { x: number; y: number }) {
    const current = flow.value;
    if (!current) return;
    const size = current.engine.get("root-size");
    const viewport = current.engine.get("viewport");
    const point = client
        ? current.engine.get("screen-to-flow", client)
        : {
              x: (size.width / 2 - viewport.x) / viewport.zoom,
              y: (size.height / 2 - viewport.y) / viewport.zoom,
          };
    added += 1;
    const id = `${entry.id}-${added}`;
    // the new step is centred on the point, and selected so the inspector shows it
    current.model.run("batch", {
        commands: [
            {
                command: "node.add",
                payload: entry.create(id, {
                    x: Math.round(point.x - 110),
                    y: Math.round(point.y - 30),
                }),
            },
            { command: "selection.set", payload: { nodeIds: [id] } },
        ],
    });
}

function onDragOver(event: DragEvent) {
    if (!event.dataTransfer?.types.includes(STEP_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
}

function onDrop(event: DragEvent) {
    const entry = CATALOG.find(
        (item) => item.id === event.dataTransfer?.getData(STEP_MIME),
    );
    if (!entry) return;
    event.preventDefault();
    addStep(entry, { x: event.clientX, y: event.clientY });
}
</script>

<template>
    <div :class="styles.app">
        <header :class="styles.header">
            <span :class="styles.logo">
                <WorkflowIcon />
            </span>
            <div :class="styles.headerText">
                <h1 :class="styles.appTitle">Order follow-up</h1>
                <p :class="styles.breadcrumb">Automations · Draft</p>
            </div>
            <Badge
                variant="soft"
                :class="styles.statusBadge(count === 0)"
                data-testid="status"
            >
                {{ count === 0 ? "Ready" : `${count} issue${count > 1 ? "s" : ""}` }}
            </Badge>
            <button type="button" :disabled="count > 0" :class="styles.publish">
                Publish
            </button>
        </header>
        <Palette @add="addStep" />
        <Flow.Root
            :model="model"
            :flow-ref="flow"
            :fit-view="{ padding: 0.08, maxZoom: 1 }"
            :min-zoom="0.3"
            :path-options="{ borderRadius: 10 }"
            aria-label="Workflow canvas"
            role="group"
            :class="styles.root"
            @dragover="onDragOver"
            @drop="onDrop"
        >
            <Flow.Background variant="dots" :size="2" :class="styles.dots" />
            <Flow.Background variant="lines" :class="styles.lines" />
            <Flow.Background variant="cross" :class="styles.cross" />
            <Flow.Viewport>
                <Flow.Edges v-slot="{ edge }">
                    <Flow.Edge
                        :edge="edge"
                        role="group"
                        aria-roledescription="connection"
                        :aria-label="`${edge.source} to ${edge.target}`"
                        :class="styles.edgeGroup"
                    >
                        <Flow.EdgePath :class="styles.edgeHit" />
                        <Flow.EdgePath :class="styles.edge" />
                        <!-- a condition's outputs are its branches: the edge says which it leaves by -->
                        <Flow.EdgeLabel
                            v-if="edge.sourceHandle === 'yes' || edge.sourceHandle === 'no'"
                            :class="styles.branchLabel(edge.sourceHandle)"
                        >
                            {{ edge.sourceHandle }}
                        </Flow.EdgeLabel>
                    </Flow.Edge>
                </Flow.Edges>
                <Flow.Nodes v-slot="{ node }">
                    <StepNode :step="node" />
                </Flow.Nodes>
                <Flow.ConnectionLine :class="styles.connection" />
            </Flow.Viewport>
            <Flow.SelectionBox :class="styles.box" />
            <Flow.Controls role="group" aria-label="Zoom" :class="styles.controls">
                <Flow.ZoomIn aria-label="Zoom in" :class="styles.control">
                    <PlusIcon />
                </Flow.ZoomIn>
                <Flow.ZoomOut aria-label="Zoom out" :class="styles.control">
                    <MinusIcon />
                </Flow.ZoomOut>
                <Flow.FitView aria-label="Fit view" :class="styles.control">
                    <MaximizeIcon />
                </Flow.FitView>
            </Flow.Controls>
            <MiniMap
                v-slot="{ view }"
                :width="120"
                :height="84"
                role="img"
                aria-label="Minimap of the workflow"
                :class="styles.minimap"
            >
                <MiniMapNode
                    v-for="item in view.nodes"
                    :key="item.nodeId"
                    :node-id="item.nodeId"
                    :class="styles.minimapNode"
                />
                <MiniMapMask :class="styles.minimapMask" />
            </MiniMap>
        </Flow.Root>
        <Inspector :model="model" />
    </div>
</template>
