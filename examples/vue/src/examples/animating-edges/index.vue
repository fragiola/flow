<script lang="ts">
import type { FlowEdgeInput, FlowNodeInput, FlowTypes } from "@fragiola/flow-vue";
import { drag } from "@fragiola/flow-vue/drag";
import { keyboard } from "@fragiola/flow-vue/keyboard";
import { selection } from "@fragiola/flow-vue/selection";
import type { Motion } from "./motion";

// The package animates nothing: an edge moves by what the app puts in it. A dot travels along the
// first edge (an SVG `<animateMotion>` whose `path` is the edge's own, `useEdge(edge).state.path`,
// so it follows the edge while a node is dragged), dashes flow along the second (an `<animate>` of
// the path's `stroke-dashoffset`), and the third pulses once when a value passes: "Send a value"
// marks it `data-pulsing`, its style runs one pulse, and `animationend` clears the mark and hands
// the value over. Under `prefers-reduced-motion` (read with `matchMedia`, followed live) neither
// the dot nor the dashes move, and those edges say so (`data-reduced-motion`).

export interface Types extends FlowTypes {
    readonly nodes: {
        step: { label: string };
        sender: { label: string };
        counter: { label: string };
    };
    readonly edges: { animated: { motion: Motion } };
}

export const features = [selection(), drag(), keyboard()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "ingest",
        type: "step",
        position: { x: 0, y: 0 },
        data: { label: "Ingest" },
    },
    {
        id: "process",
        type: "step",
        position: { x: 300, y: 0 },
        data: { label: "Process" },
    },
    {
        id: "store",
        type: "step",
        position: { x: 600, y: 0 },
        data: { label: "Store" },
    },
    {
        id: "sender",
        type: "sender",
        position: { x: 120, y: 200 },
        data: { label: "Sender" },
    },
    {
        id: "counter",
        type: "counter",
        position: { x: 480, y: 200 },
        data: { label: "Counter" },
    },
];

const animated = (source: string, target: string, motion: Motion) => ({
    id: `${source}-${target}`,
    source,
    target,
    type: "animated" as const,
    data: { motion },
});

const edges: FlowEdgeInput<Types>[] = [
    animated("ingest", "process", "travel"),
    animated("process", "store", "dash"),
    animated("sender", "counter", "pulse"),
];

export const LABELS: Record<string, string> = Object.fromEntries(
    nodes.map((node) => [node.id, node.data.label]),
);
</script>

<script setup lang="ts">
import { typedFlow } from "@fragiola/flow-vue";
import { onMounted, onUnmounted, ref } from "vue";
import AnimatedEdge from "./animated-edge.vue";
import CounterBody from "./counter-body.vue";
import { onReducedMotionChange, prefersReducedMotion } from "./motion";
import SenderBody from "./sender-body.vue";
import { styles } from "./styles";

const Flow = typedFlow<Types, typeof features>();

/** Whether the user asked for reduced motion, followed live; a server render assumes not. */
const reduced = ref(false);
let stopReducedMotion = () => {};
onMounted(() => {
    reduced.value = prefersReducedMotion();
    stopReducedMotion = onReducedMotionChange(() => {
        reduced.value = prefersReducedMotion();
    });
});
onUnmounted(() => stopReducedMotion());

// The values passing from the sender to the counter: app state, outside the flow's document.
/** a value is on its way: the pulse is running */
const sending = ref(false);
/** how many values the counter has received */
const received = ref(0);

const send = () => {
    sending.value = true;
};
/** the pulse ended: the value arrives */
const arrive = () => {
    sending.value = false;
    received.value += 1;
};
/** the pulse's edge is gone: the value is dropped */
const drop = () => {
    sending.value = false;
};
</script>

<template>
    <Flow.Root
        :features="features"
        :default-nodes="nodes"
        :default-edges="edges"
        :fit-view="{ padding: 0.15, maxZoom: 1 }"
        role="group"
        aria-label="Animating edges"
        :class="styles.root"
    >
        <Flow.Background variant="dots" :size="2" :class="styles.dots" />
        <Flow.Background variant="lines" :class="styles.lines" />
        <Flow.Background variant="cross" :class="styles.cross" />
        <Flow.Viewport>
            <Flow.Edges v-slot="{ edge }">
                <AnimatedEdge
                    :edge="edge"
                    :reduced="reduced"
                    :sending="sending"
                    @arrive="arrive"
                />
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
                    <SenderBody
                        v-if="node.type === 'sender'"
                        :label="node.data.label"
                        :sending="sending"
                        @send="send"
                        @drop="drop"
                    />
                    <CounterBody
                        v-else-if="node.type === 'counter'"
                        :label="node.data.label"
                        :received="received"
                    />
                    <template v-else>{{ node.data.label }}</template>
                    <Flow.Handle type="source" side="right" :class="styles.handle" />
                </Flow.Node>
            </Flow.Nodes>
        </Flow.Viewport>
    </Flow.Root>
</template>
