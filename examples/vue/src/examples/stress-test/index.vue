<script lang="ts">
import type { FlowTypes } from "@fragiola/flow-vue";
import { drag } from "@fragiola/flow-vue/drag";
import { selection } from "@fragiola/flow-vue/selection";

// A flow of thousands of nodes and as many edges, generated (generate.ts: a seeded grid joined into
// one tree, the same every time), 1,000 by default and up to 20,000. `only-render-visible` keeps in
// the DOM only the nodes and edges in view, so the DOM stays small whatever the size; the readout
// shows what each gesture costs. The nodes declare their size and handles, so a node never drawn
// still has a box (it is culled rightly) and its edges have ends. Until the root has a size (the
// view known), a culled flow renders no node, so no more than the visible ones ever mount.
// "Shuffle" moves every node in one `batch`: one change, one render. The readout counts the nodes
// and edges in the DOM and times the frames (requestAnimationFrame, the median of the last 60,
// frames.ts), the last size switch and the last shuffle (until the next frame). The node and edge
// slots are template slots, so a pan or a drag step re-renders only what changed.

export interface Types extends FlowTypes {
    readonly nodes: { cell: { label: string } };
}

export const features = [selection(), drag()] as const;

/** How the size picker names a size: "10,000 nodes". */
const sizeName = (size: number) => `${size.toLocaleString("en-US")} nodes`;

/** A node's place as it prints it, for the tests: "x, y", rounded. */
const placeOf = (position: { readonly x: number; readonly y: number }) =>
    `${Math.round(position.x)}, ${Math.round(position.y)}`;

/** Calls `done` with the time since `start` once the next frame begins (the change is drawn). */
function timeToFrame(start: number, done: (ms: number) => void) {
    requestAnimationFrame(() => done(performance.now() - start));
}
</script>

<script setup lang="ts">
import { typedFlow, useFlowRef } from "@fragiola/flow-vue";
import { ShuffleIcon } from "@lucide/vue";
import { computed, onMounted, onUnmounted, ref, shallowRef } from "vue";
import { formatMs, frameMeter } from "./frames";
import { generateFlow, labelOf, SIZES, type Size, shuffle } from "./generate";
import { styles } from "./styles";

const Flow = typedFlow<Types, typeof features>();

const size = ref<Size>(SIZES[0]);
const flowData = computed(() => generateFlow(size.value));
const flow = useFlowRef<Types, typeof features>();
const frame = ref<HTMLDivElement | null>(null);
// when the shown size was asked for: the setup, then each switch
let switchedAt = performance.now();
const renderMs = ref<number>();
const shuffleMs = ref<number>();
let shuffles = 0;

// The nodes and edges in the DOM and the frame time, read a few times a second.
const counts = shallowRef<{
    readonly nodes: number;
    readonly edges: number;
    readonly frameMs: number | undefined;
}>({ nodes: 0, edges: 0, frameMs: undefined });
const meter = frameMeter(60);
let ticks = 0;
let frameId = 0;
// a hidden tab gets no frames: the gap after it is not a frame
const onVisibility = () => meter.reset();
onMounted(() => {
    frameId = requestAnimationFrame(function onFrame(time) {
        meter.tick(time);
        ticks += 1;
        // every 15th frame: a readout updated each frame would cost frames itself
        if (ticks % 15 === 0 && frame.value) {
            const root = frame.value;
            counts.value = {
                nodes: root.querySelectorAll('[data-flow-part="node"]').length,
                edges: root.querySelectorAll('[data-flow-part="edge"]').length,
                frameMs: meter.median(),
            };
        }
        frameId = requestAnimationFrame(onFrame);
    });
    document.addEventListener("visibilitychange", onVisibility);
});
onUnmounted(() => {
    cancelAnimationFrame(frameId);
    document.removeEventListener("visibilitychange", onVisibility);
});

function onInit() {
    timeToFrame(switchedAt, (ms) => {
        renderMs.value = ms;
    });
}

function onSize(value: string) {
    const next = SIZES.find((option) => String(option) === value);
    if (next === undefined || next === size.value) return;
    switchedAt = performance.now();
    renderMs.value = undefined;
    shuffleMs.value = undefined;
    size.value = next;
}

function onShuffle() {
    const model = flow.value?.model;
    if (!model) return;
    shuffles += 1;
    const start = performance.now();
    const moves = shuffle(model.get("all-nodes"), shuffles + 1);
    // every move in one batch: one change of the document, one render
    model.run("batch", {
        commands: moves.map((payload) => ({
            command: "node.move" as const,
            payload,
        })),
    });
    timeToFrame(start, (ms) => {
        shuffleMs.value = ms;
    });
}
</script>

<template>
    <div ref="frame" :class="styles.frame">
        <!-- a new size is a new flow -->
        <Flow.Root
            :key="size"
            :features="features"
            :default-nodes="flowData.nodes"
            :default-edges="flowData.edges"
            :default-viewport="{ x: 48, y: 120, zoom: 1 }"
            :min-zoom="0.1"
            only-render-visible
            :flow-ref="flow"
            role="group"
            aria-label="Stress test"
            :aria-busy="renderMs === undefined"
            :class="styles.root"
            @init="onInit"
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
                    <!-- a cheap node: one element and its label, its place on it for the tests -->
                    <Flow.Node
                        :node="node"
                        role="group"
                        aria-roledescription="node"
                        :aria-label="node.data.label"
                        :data-position="placeOf(node.position)"
                        :class="styles.node"
                    >
                        {{ node.data.label }}
                    </Flow.Node>
                </Flow.Nodes>
            </Flow.Viewport>
        </Flow.Root>
        <div data-flow-no-gesture="" :class="styles.panel">
            <label :class="styles.field">
                <span>Size</span>
                <select
                    :value="size"
                    :class="styles.select"
                    @change="onSize(($event.target as HTMLSelectElement).value)"
                >
                    <option v-for="option in SIZES" :key="option" :value="option">
                        {{ sizeName(option) }}
                    </option>
                </select>
            </label>
            <button type="button" :class="styles.button" @click="onShuffle">
                <ShuffleIcon />
                Shuffle
            </button>
            <dl
                aria-label="Readout"
                data-testid="readout"
                :data-size="size"
                :data-edges="flowData.edges.length"
                :data-dom-nodes="counts.nodes"
                :data-dom-edges="counts.edges"
                :data-frame-ms="formatMs(counts.frameMs)"
                :data-render-ms="formatMs(renderMs)"
                :data-shuffle-ms="formatMs(shuffleMs)"
                :class="styles.readout"
            >
                <div :class="styles.stat">
                    <dt>In the DOM</dt>
                    <dd :class="styles.value">
                        {{ counts.nodes }} nodes, {{ counts.edges }} edges
                    </dd>
                </div>
                <div :class="styles.stat">
                    <dt>Frame</dt>
                    <dd :class="styles.value">{{ formatMs(counts.frameMs) }} ms</dd>
                </div>
                <div :class="styles.stat">
                    <dt>Rendered in</dt>
                    <dd :class="styles.value">{{ formatMs(renderMs) }} ms</dd>
                </div>
                <div :class="styles.stat">
                    <dt>Shuffled in</dt>
                    <dd :class="styles.value">{{ formatMs(shuffleMs) }} ms</dd>
                </div>
            </dl>
        </div>
    </div>
</template>
