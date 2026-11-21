<script lang="ts">
import type {
    FlowEdgeInput,
    FlowNodeInput,
    FlowTypes,
} from "@fragiola/flow-vue";
import { connection } from "@fragiola/flow-vue/connection";
import { drag } from "@fragiola/flow-vue/drag";
import { selection } from "@fragiola/flow-vue/selection";

// `Flow.EdgeLabel` is HTML placed at the edge's label point (halfway along its path), in flow
// coordinates: it pans and zooms with the edge. It may hold anything: text from the edge's data, a
// badge, a button (remove-button.vue). A button in a label keeps its own clicks (it never starts a
// gesture).

export interface Types extends FlowTypes {
    readonly nodes: { stage: { label: string } };
    readonly edges: {
        text: { text: string };
        status: { status: "passing" | "failing" };
        removable: Record<string, never>;
    };
}

export const features = [selection(), drag(), connection()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "build",
        type: "stage",
        position: { x: 0, y: 0 },
        data: { label: "Build" },
    },
    {
        id: "test",
        type: "stage",
        position: { x: 280, y: 0 },
        data: { label: "Test" },
    },
    {
        id: "lint",
        type: "stage",
        position: { x: 280, y: 180 },
        data: { label: "Lint" },
    },
    {
        id: "deploy",
        type: "stage",
        position: { x: 560, y: 90 },
        data: { label: "Deploy" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    {
        id: "build-test",
        source: "build",
        target: "test",
        type: "text",
        data: { text: "on push" },
    },
    {
        id: "build-lint",
        source: "build",
        target: "lint",
        type: "status",
        data: { status: "failing" },
    },
    {
        id: "test-deploy",
        source: "test",
        target: "deploy",
        type: "status",
        data: { status: "passing" },
    },
    {
        id: "lint-deploy",
        source: "lint",
        target: "deploy",
        type: "removable",
        data: {},
    },
];
</script>

<script setup lang="ts">
import { typedFlow } from "@fragiola/flow-vue";
import { Badge } from "#/components/atoms/badge";
import RemoveButton from "./remove-button.vue";
import { styles } from "./styles";

const Flow = typedFlow<Types, typeof features>();
</script>

<template>
    <Flow.Root
        :features="features"
        :default-nodes="nodes"
        :default-edges="edges"
        :fit-view="{ padding: 0.2, maxZoom: 1 }"
        :path-options="{ borderRadius: 8 }"
        :class="styles.root"
    >
        <Flow.Background variant="dots" :size="2" :class="styles.dots" />
        <Flow.Background variant="lines" :class="styles.lines" />
        <Flow.Background variant="cross" :class="styles.cross" />
        <Flow.Viewport>
            <Flow.Edges v-slot="{ edge }">
                <Flow.Edge :edge="edge">
                    <Flow.EdgePath :class="styles.edge" />
                    <Flow.EdgeLabel :class="styles.label">
                        <span v-if="edge.type === 'text'" :class="styles.text">
                            {{ edge.data?.text }}
                        </span>
                        <Badge
                            v-else-if="edge.type === 'status'"
                            variant="soft"
                            :class="styles.status(edge.data?.status)"
                        >
                            {{ edge.data?.status }}
                        </Badge>
                        <RemoveButton
                            v-else-if="edge.type === 'removable'"
                            :edge="edge"
                        />
                    </Flow.EdgeLabel>
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
    </Flow.Root>
</template>
