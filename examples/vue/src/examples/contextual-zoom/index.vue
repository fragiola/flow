<script lang="ts">
import type { FlowJson, FlowTypes } from "@fragiola/flow-vue";
import { drag } from "@fragiola/flow-vue/drag";
import { keyboard } from "@fragiola/flow-vue/keyboard";
import { selection } from "@fragiola/flow-vue/selection";

// The nodes show more as the flow zooms in: at a glance only their name, closer their kind and
// health, closest their owner and figures. The edges' labels show from a zoom of 1. The zoom is
// view state: `useViewport()` gives it (the readout in the corner, zoom-readout.vue, re-renders
// with every frame of a pan or zoom), and `useFlowStore` selects only what a part needs from it
// (`detailOf(zoom)`, a string, in service-node.vue), so a node re-renders when its level changes,
// not on every frame. The thresholds live in `detail.ts`; each node carries its level as
// `data-detail`.

interface Service {
    label: string;
    kind: string;
    owner: string;
    health: "healthy" | "degraded";
    requests: string;
    latency: string;
}

export interface Types extends FlowTypes {
    readonly nodes: { service: Service };
    readonly edges: { call: { label: string } };
}

export const features = [selection(), drag(), keyboard()] as const;

const service = (id: string, x: number, y: number, data: Service) => ({
    id,
    type: "service" as const,
    position: { x, y },
    data,
});

const call = (source: string, target: string, label: string) => ({
    id: `${source}-${target}`,
    source,
    target,
    type: "call" as const,
    data: { label },
});

const json: FlowJson<Types> = {
    version: 1,
    nodes: [
        service("gateway", 0, 120, {
            label: "Gateway",
            kind: "Edge proxy",
            owner: "Platform",
            health: "healthy",
            requests: "1.2k req/s",
            latency: "18 ms",
        }),
        service("orders", 300, 0, {
            label: "Orders",
            kind: "HTTP service",
            owner: "Commerce",
            health: "healthy",
            requests: "340 req/s",
            latency: "42 ms",
        }),
        service("search", 300, 240, {
            label: "Search",
            kind: "HTTP service",
            owner: "Discovery",
            health: "degraded",
            requests: "860 req/s",
            latency: "310 ms",
        }),
        service("billing", 600, 0, {
            label: "Billing",
            kind: "Worker",
            owner: "Payments",
            health: "healthy",
            requests: "75 jobs/s",
            latency: "90 ms",
        }),
        service("index", 600, 240, {
            label: "Index",
            kind: "Database",
            owner: "Discovery",
            health: "healthy",
            requests: "2.4k reads/s",
            latency: "4 ms",
        }),
    ],
    edges: [
        call("gateway", "orders", "POST /orders"),
        call("gateway", "search", "GET /search"),
        call("orders", "billing", "charge"),
        call("search", "index", "query"),
    ],
};

/** The nodes' labels, for the edges' names. */
const LABELS: Record<string, string> = Object.fromEntries(
    json.nodes.map((node) => [node.id, node.data.label]),
);

export const labelOf = (id: string) => LABELS[id] ?? id;
</script>

<script setup lang="ts">
import { typedFlow } from "@fragiola/flow-vue";
import { MaximizeIcon, MinusIcon, PlusIcon } from "@lucide/vue";
import CallEdge from "./call-edge.vue";
import ServiceNode from "./service-node.vue";
import { styles } from "./styles";
import ZoomReadout from "./zoom-readout.vue";

const Flow = typedFlow<Types, typeof features>();
</script>

<template>
    <Flow.Root
        :features="features"
        :default-nodes="json.nodes"
        :default-edges="json.edges"
        :fit-view="{ padding: 0.2, maxZoom: 1 }"
        :min-zoom="0.4"
        :max-zoom="2"
        role="group"
        aria-label="Contextual zoom"
        :class="styles.root"
    >
        <Flow.Background variant="dots" :size="2" :class="styles.dots" />
        <Flow.Background variant="lines" :class="styles.lines" />
        <Flow.Background variant="cross" :class="styles.cross" />
        <Flow.Viewport>
            <Flow.Edges v-slot="{ edge }">
                <CallEdge :edge="edge" />
            </Flow.Edges>
            <Flow.Nodes v-slot="{ node }">
                <ServiceNode :node="node" />
            </Flow.Nodes>
        </Flow.Viewport>
        <Flow.Controls role="group" aria-label="Zoom" :class="styles.controls">
            <Flow.ZoomIn :duration="200" aria-label="Zoom in" :class="styles.control">
                <PlusIcon />
            </Flow.ZoomIn>
            <Flow.ZoomOut :duration="200" aria-label="Zoom out" :class="styles.control">
                <MinusIcon />
            </Flow.ZoomOut>
            <Flow.FitView
                :duration="200"
                :padding="0.2"
                :max-zoom="1"
                aria-label="Fit view"
                :class="styles.control"
            >
                <MaximizeIcon />
            </Flow.FitView>
        </Flow.Controls>
        <ZoomReadout />
    </Flow.Root>
</template>
