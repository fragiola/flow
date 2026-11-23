<script lang="ts">
import type {
    FlowEdgeInput,
    FlowEngine,
    FlowModel,
    FlowNode,
    FlowNodeInput,
    FlowTypes,
} from "@fragiola/flow-vue";
import { drag } from "@fragiola/flow-vue/drag";
import { selection } from "@fragiola/flow-vue/selection";
import { type Algorithm, type LayoutNode, layoutGraph, type Placement } from "./layout";

// A data pipeline laid out by ELK (`layout.ts`): its nodes declare their size and have several
// named inputs (left) and outputs (right), each edge joins two of them. Each handle is an ELK port
// on its side, and ELK may reorder the ports of a side to uncross the edges. The document opens
// in a naive order (the edges cross); once mounted, ELK lays it out (async): in ONE `batch`, each
// node's `node.set-data` takes the handle order ELK chose (the handles are keyed by their side's
// order, so they remount and the engine measures them again) and `node.move` its place; then `fit-view`
// animated. "Algorithm" lays it out again, "Layered" or "Tree" (`mrtree`); a request id keeps a
// layout that resolves after a newer one was asked for from applying. The root carries
// `data-algorithm` and `data-layout="running" | "done"`.

interface Types extends FlowTypes {
    readonly nodes: {
        stage: { label: string; inputs: string[]; outputs: string[] };
    };
}

const features = [selection(), drag()] as const;

/** Every node's width, and the rows its height is made of, in flow units (`styles.ts`). */
const WIDTH = 170;
const TITLE = 28;
const ROW = 20;
const PADDING = 8;

/** How the view fits the pipeline: some room around it, never zoomed in past 1. */
const FIT = { padding: 0.15, maxZoom: 1 };

const FIRST: Algorithm = "layered";

type Stage = readonly [
    id: string,
    label: string,
    inputs: readonly string[],
    outputs: readonly string[],
];

/**
 * The pipeline: three sources joined, sessionized and enriched into a warehouse, with a quality
 * report of what failed. The handles are listed in an order that crosses the edges (Join's
 * "customers" above "orders", whose source is above), for ELK to put right.
 */
const STAGES: readonly Stage[] = [
    ["quality", "Quality report", ["errors", "unmatched"], []],
    ["orders", "Orders API", [], ["records"]],
    ["enrich", "Enrich", ["sessions", "matched"], ["errors", "profiles"]],
    ["customers", "Customers DB", [], ["rows"]],
    ["join", "Join", ["customers", "orders"], ["unmatched", "matched"]],
    ["dashboard", "Dashboard", ["tables"], []],
    ["clicks", "Clickstream", [], ["events"]],
    ["warehouse", "Warehouse", ["bounces", "profiles"], ["tables"]],
    ["sessions", "Sessionize", ["events"], ["bounces", "sessions"]],
];

/** Each edge: source node and output, target node and input. */
const LINKS: readonly (readonly [
    source: string,
    output: string,
    target: string,
    input: string,
])[] = [
    ["orders", "records", "join", "orders"],
    ["customers", "rows", "join", "customers"],
    ["clicks", "events", "sessions", "events"],
    ["join", "matched", "enrich", "matched"],
    ["join", "unmatched", "quality", "unmatched"],
    ["sessions", "sessions", "enrich", "sessions"],
    ["sessions", "bounces", "warehouse", "bounces"],
    ["enrich", "profiles", "warehouse", "profiles"],
    ["enrich", "errors", "quality", "errors"],
    ["warehouse", "tables", "dashboard", "tables"],
];

const LABELS: Record<string, string> = Object.fromEntries(
    STAGES.map(([id, label]) => [id, label]),
);

const labelOf = (id: string) => LABELS[id] ?? id;

const heightOf = (inputs: number, outputs: number) =>
    TITLE + ROW * Math.max(1, inputs, outputs) + PADDING;

// a naive placement: a grid in the list's order, where the edges cross; ELK replaces it on open
const nodes: FlowNodeInput<Types>[] = STAGES.map(([id, label, inputs, outputs], index) => ({
    id,
    type: "stage",
    position: { x: (index % 3) * 240, y: Math.floor(index / 3) * 130 },
    width: WIDTH,
    height: heightOf(inputs.length, outputs.length),
    data: { label, inputs: [...inputs], outputs: [...outputs] },
}));

const edges: FlowEdgeInput<Types>[] = LINKS.map(([source, output, target, input]) => ({
    id: `${source}-${target}`,
    source,
    target,
    sourceHandle: output,
    targetHandle: input,
}));

const ALGORITHM_NAMES: Record<Algorithm, string> = {
    layered: "Layered",
    mrtree: "Tree",
};

/** What the layout reads of a node: its id, declared size and handles. */
const layoutNodeOf = (node: FlowNode<Types>): LayoutNode => ({
    id: node.id,
    width: node.width ?? WIDTH,
    height: node.height ?? heightOf(node.data.inputs.length, node.data.outputs.length),
    inputs: node.data.inputs,
    outputs: node.data.outputs,
});

/** Lays the flow's document out with ELK: every node's place and handle order. */
function layout(model: FlowModel<Types, typeof features>, algorithm: Algorithm) {
    return layoutGraph(
        model.get("all-nodes").map(layoutNodeOf),
        model.get("all-edges"),
        algorithm,
    );
}

/**
 * Applies ELK's result as ONE change: each node's handle order and its place, in one `batch`
 * (one step for a history or a save); then fits the view to it, animated, once the engine can.
 */
function apply(
    model: FlowModel<Types, typeof features>,
    engine: FlowEngine<Types, typeof features>,
    placements: ReadonlyMap<string, Placement>,
) {
    model.run("batch", {
        commands: [...placements].flatMap(([nodeId, placement]) => [
            {
                command: "node.set-data" as const,
                payload: {
                    nodeId,
                    data: {
                        inputs: [...placement.inputs],
                        outputs: [...placement.outputs],
                    },
                },
            },
            {
                command: "node.move" as const,
                payload: { nodeId, position: placement.position },
            },
        ]),
    });
    // before `ready` the root's own `fitView` fits the laid-out nodes once they are measured
    if (engine.is("ready")) engine.run("fit-view", { ...FIT, duration: 300 });
}

/** A node's place as it prints it, for the tests: "x, y", rounded. */
const placeOf = (node: FlowNode<Types>) =>
    `${Math.round(node.position.x)}, ${Math.round(node.position.y)}`;
</script>

<script setup lang="ts">
import { typedFlow, useFlowRef } from "@fragiola/flow-vue";
import { onMounted, onUnmounted, ref } from "vue";
import { ALGORITHMS } from "./layout";
import { styles } from "./styles";

const Flow = typedFlow<Types, typeof features>();

const flow = useFlowRef<Types, typeof features>();
const algorithm = ref<Algorithm>(FIRST);
const running = ref(true);
// the latest layout asked for: an older one that resolves later is dropped
let request = 0;

function arrange(next: Algorithm) {
    const current = flow.value;
    if (!current) return;
    const { model, engine } = current;
    request += 1;
    const id = request;
    algorithm.value = next;
    running.value = true;
    void layout(model, next)
        .then((placements) => {
            if (id !== request) return;
            apply(model, engine, placements);
            running.value = false;
        })
        .catch((error: unknown) => {
            // a failed layout leaves the nodes where they are, and the controls usable again
            if (id !== request) return;
            console.error("The ELK layout failed", error);
            running.value = false;
        });
}

// the first layout, once mounted (the model is there); leaving drops a pending one
onMounted(() => arrange(FIRST));
onUnmounted(() => {
    request += 1;
});
</script>

<template>
    <Flow.Root
        :features="features"
        :default-nodes="nodes"
        :default-edges="edges"
        :fit-view="FIT"
        :flow-ref="flow"
        role="group"
        aria-label="ELK layout"
        :data-algorithm="algorithm"
        :data-layout="running ? 'running' : 'done'"
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
                    :data-position="placeOf(node)"
                    :class="styles.node"
                >
                    <span :class="styles.title">{{ node.data.label }}</span>
                    <span :class="styles.ports">
                        <!-- a side's handles are keyed by that side's order: a new order remounts
                             them, so the engine measures their new centres (it does so when a
                             handle registers) -->
                        <span :class="styles.column">
                            <span
                                v-for="input in node.data.inputs"
                                :key="`${node.data.inputs.join(',')}/${input}`"
                                :class="styles.inputRow"
                            >
                                <Flow.Handle
                                    type="target"
                                    side="left"
                                    :handle-id="input"
                                    :class="styles.handle"
                                />
                                {{ input }}
                            </span>
                        </span>
                        <span :class="styles.column">
                            <span
                                v-for="output in node.data.outputs"
                                :key="`${node.data.outputs.join(',')}/${output}`"
                                :class="styles.outputRow"
                            >
                                {{ output }}
                                <Flow.Handle
                                    type="source"
                                    side="right"
                                    :handle-id="output"
                                    :class="styles.handle"
                                />
                            </span>
                        </span>
                    </span>
                </Flow.Node>
            </Flow.Nodes>
        </Flow.Viewport>
        <fieldset :class="styles.panel">
            <legend :class="styles.legend">Algorithm</legend>
            <label v-for="option in ALGORITHMS" :key="option" :class="styles.option">
                <input
                    type="radio"
                    name="elk-algorithm"
                    :value="option"
                    :checked="algorithm === option"
                    :class="styles.radio"
                    @change="arrange(option)"
                />
                {{ ALGORITHM_NAMES[option] }}
            </label>
        </fieldset>
    </Flow.Root>
</template>
