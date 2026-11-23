<script lang="ts">
import type {
    FlowEdge,
    FlowEdgeInput,
    FlowNodeInput,
    FlowTypes,
} from "@fragiola/flow-vue";
import { drag } from "@fragiola/flow-vue/drag";
import { keyboard } from "@fragiola/flow-vue/keyboard";
import { selection } from "@fragiola/flow-vue/selection";
import { describeEnds, type Ends, markersFor } from "./markers";

// No marker is built in: markers are plain SVG. The example defines its own `<marker>`s (arrows,
// open arrows, circles and diamonds, `markers.ts`) in an svg of its own, and points each edge
// path's `marker-start` / `marker-end` at them. A marker is coloured where it is defined, not by the
// path that uses it, so there is one per shape and tone, and one per shape for the selected state:
// selected, the path's `data-selected` swaps to those (`--marker-*-selected`, `styles.ts`). The ids
// start with `useId`, so two of these flows on one page never point at each other's markers.

export interface Types extends FlowTypes {
    readonly nodes: { service: { label: string } };
    readonly edges: {
        marked: Ends;
    };
}

export const features = [selection(), drag(), keyboard()] as const;

const service = (id: string, label: string, x: number, y: number) => ({
    id,
    type: "service" as const,
    position: { x, y },
    data: { label },
});

const nodes: FlowNodeInput<Types>[] = [
    service("client", "Client", 0, 120),
    service("gateway", "Gateway", 240, 120),
    service("auth", "Auth", 500, 0),
    service("orders", "Orders", 500, 240),
    service("database", "Database", 760, 160),
    service("cache", "Cache", 760, 330),
];

/** Each edge's ends and tone: what its markers are. */
const MARKED: readonly (readonly [string, string, Ends])[] = [
    ["client", "gateway", { end: "arrow", tone: "neutral" }],
    ["gateway", "auth", { start: "circle", end: "open-arrow", tone: "purple" }],
    ["gateway", "orders", { start: "diamond", end: "arrow", tone: "blue" }],
    ["orders", "database", { start: "arrow", end: "arrow", tone: "orange" }],
    ["orders", "cache", { end: "circle", tone: "green" }],
];

const edges: FlowEdgeInput<Types>[] = MARKED.map(([source, target, data]) => ({
    id: `${source}-${target}`,
    source,
    target,
    type: "marked",
    data,
}));

/** The markers these edges use, each defined once per flow. */
const MARKERS = markersFor(MARKED.map(([, , ends]) => ends));

/** An edge's ends: its data when it is a marked edge, none otherwise. */
const endsOf = (edge: FlowEdge<Types>): Ends =>
    edge.type === "marked" && edge.data ? edge.data : { tone: "neutral" };

const LABELS: Record<string, string> = Object.fromEntries(
    nodes.map((node) => [node.id, node.data.label]),
);

/** An edge's accessible name: its nodes and its ends. */
const edgeLabel = (edge: FlowEdge<Types>) =>
    `${LABELS[edge.source]} to ${LABELS[edge.target]}: ${describeEnds(endsOf(edge))}`;
</script>

<script setup lang="ts">
import { typedFlow } from "@fragiola/flow-vue";
import { useId } from "vue";
import { GEOMETRY, idPrefix, markerId, markerUrl } from "./markers";
import { styles } from "./styles";

const Flow = typedFlow<Types, typeof features>();
const prefix = idPrefix(useId());

/** The visible path's markers in its tone, and the selected ones its `data-selected` swaps to. */
function pathMarkers(edge: FlowEdge<Types>) {
    const ends = endsOf(edge);
    return {
        "marker-start": markerUrl(prefix, ends.start, ends.tone),
        "marker-end": markerUrl(prefix, ends.end, ends.tone),
        style: {
            "--marker-start-selected": markerUrl(prefix, ends.start, "selected"),
            "--marker-end-selected": markerUrl(prefix, ends.end, "selected"),
        },
    };
}
</script>

<template>
    <Flow.Root
        :features="features"
        :default-nodes="nodes"
        :default-edges="edges"
        :fit-view="{ padding: 0.15, maxZoom: 1 }"
        role="group"
        aria-label="Edge markers"
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
                    :aria-label="edgeLabel(edge)"
                    :class="styles.edgeGroup"
                >
                    <!-- a wide transparent path: a bigger target for a click -->
                    <Flow.EdgePath :class="styles.edgeHit" />
                    <Flow.EdgePath
                        v-bind="pathMarkers(edge)"
                        :class="styles.edge(endsOf(edge).tone)"
                    />
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
        <!-- the markers, in an svg of no size: every edge path of this flow points at them -->
        <svg aria-hidden="true" :class="styles.defs">
            <defs>
                <marker
                    v-for="{ shape, state } in MARKERS"
                    :id="markerId(prefix, shape, state)"
                    :key="`${shape}-${state}`"
                    viewBox="0 0 10 10"
                    :refX="GEOMETRY[shape].refX"
                    refY="5"
                    markerWidth="12"
                    markerHeight="12"
                    markerUnits="userSpaceOnUse"
                    orient="auto-start-reverse"
                    :class="styles.marker(state)"
                >
                    <path
                        :d="GEOMETRY[shape].d"
                        :class="GEOMETRY[shape].filled ? styles.filled : styles.outlined"
                    />
                </marker>
            </defs>
        </svg>
    </Flow.Root>
</template>
