<script lang="ts">
import type {
    FlowEdgeInput,
    FlowNode,
    FlowNodeInput,
    FlowTypes,
} from "@fragiola/flow-vue";
import { drag } from "@fragiola/flow-vue/drag";
import { selection } from "@fragiola/flow-vue/selection";
import type { InjectionKey } from "vue";
import { layoutPositions, type Point } from "./layout";
import {
    type PlaceholderData,
    placeholderEdge,
    placeholderNode,
    type TopicData,
    topicEdge,
    topicNode,
} from "./tree";

// A mind map that lays itself out again after every change (dagre, top to bottom, `layout.ts`).
// Under each shown topic sits a "+" placeholder, a node of its own (`add-<topic>`) with a dashed
// edge, laid out like the rest: pressing it adds a child in one `batch` (the topic, its edge, its
// own placeholder and that edge, `tree.ts`), starting at its parent's place. A topic with
// children has a toggle that collapses its subtree (toggle.vue): one `batch` writes `collapsed` in
// its data (`node.set-data`) and hides every descendant, their placeholders, its own, and the
// edges into them (`node.set-flags` / `edge.set-flags { hidden }`); expanding shows them again,
// except under a topic still collapsed. The layout runs on the shown nodes only, and they glide to
// their new places: one transient `batch` of `node.move` per animation frame (`tween.ts`), then
// one batch that is not transient with the exact places, then `fit-view` animated. The root
// carries `data-animating` while the nodes move and `data-layouts`, the number of layouts finished
// (for a test to wait on the one a press starts); a collapsed topic carries `data-collapsed`.

export interface Types extends FlowTypes {
    readonly nodes: { topic: TopicData; add: PlaceholderData };
}

export const features = [selection(), drag()] as const;

/** How long the nodes take to reach their new places, in milliseconds. */
const DURATION = 350;

/** How the view fits the tree: some room around it, never zoomed in past 1. */
const FIT = { padding: 0.15, maxZoom: 1 };

/** The map: a product launch, its teams and their first tasks. */
const TOPICS: readonly (readonly [
    id: string,
    label: string,
    parent?: string,
])[] = [
    ["launch", "Product launch"],
    ["marketing", "Marketing", "launch"],
    ["engineering", "Engineering", "launch"],
    ["support", "Support", "launch"],
    ["campaign", "Campaign", "marketing"],
    ["press", "Press kit", "marketing"],
    ["backend", "Backend", "engineering"],
    ["frontend", "Frontend", "engineering"],
    ["docs", "Help center", "support"],
];

const ORIGIN = { x: 0, y: 0 };

const firstNodes = TOPICS.flatMap(([id, label]) => [
    topicNode(id, label, ORIGIN),
    placeholderNode(id, label, ORIGIN),
]);

const edges: FlowEdgeInput<Types>[] = TOPICS.flatMap(([id, , parent]) => [
    ...(parent ? [topicEdge(parent, id)] : []),
    placeholderEdge(id),
]);

/** What the layout reads of a node: its id, declared size and whether it shows. */
const boxOf = (node: {
    id: string;
    width?: number;
    height?: number;
    hidden?: boolean;
}) => ({
    id: node.id,
    width: node.width ?? 0,
    height: node.height ?? 0,
    hidden: node.hidden,
});

// laid out before the first render: the map opens arranged, with nothing to animate
const firstPlaces = layoutPositions(firstNodes.map(boxOf), edges);

const nodes: FlowNodeInput<Types>[] = firstNodes.map((node) => ({
    ...node,
    position: firstPlaces.get(node.id) ?? ORIGIN,
}));

/** Calls `step` with the progress (0 to 1) on every animation frame for `duration` ms; returns a stop. */
function everyFrame(duration: number, step: (t: number) => void): () => void {
    const start = performance.now();
    let id = requestAnimationFrame(function onFrame(now) {
        const t = Math.min(1, (now - start) / duration);
        step(t);
        if (t < 1) id = requestAnimationFrame(onFrame);
    });
    return () => cancelAnimationFrame(id);
}

/** One `node.move` per node, for a `batch`. */
const movesTo = (positions: ReadonlyMap<string, Point>) =>
    [...positions].map(([nodeId, position]) => ({
        command: "node.move" as const,
        payload: { nodeId, position },
    }));

/** What the nodes' buttons do: add a child under a topic, collapse or expand a topic. */
export interface Actions {
    readonly add: (parentId: string) => void;
    readonly toggle: (topicId: string) => void;
}

/** The actions, for the nodes' buttons (toggle.vue, add-button.vue). */
export const ACTIONS: InjectionKey<Actions> = Symbol("auto-layout-actions");

/** A node's place as it prints it, for the tests: "x, y", rounded. */
const placeOf = (position: Point) =>
    `${Math.round(position.x)}, ${Math.round(position.y)}`;

/** A placeholder's data: the topic it adds a child to. */
const placeholderData = (node: FlowNode<Types>) =>
    node.data as PlaceholderData;
</script>

<script setup lang="ts">
import { typedFlow, useFlowRef } from "@fragiola/flow-vue";
import { onUnmounted, provide, ref } from "vue";
import AddButton from "./add-button.vue";
import { styles } from "./styles";
import Toggle from "./toggle.vue";
import { addChildCommands, toggleCommands, topicData } from "./tree";
import TreeEdge from "./tree-edge.vue";
import { tween } from "./tween";

const Flow = typedFlow<Types, typeof features>();

const flow = useFlowRef<Types, typeof features>();
const animating = ref(false);
const layouts = ref(0);
// the running animation's stop, so a new change (or leaving) ends it
let stop: (() => void) | undefined;
onUnmounted(() => stop?.());
// the next added topic's number: `topic-1` "Topic 1", `topic-2` "Topic 2", …
let counter = 1;

/** Lays the shown nodes out again and glides them there from where they are. */
function relayout() {
    const current = flow.value;
    if (!current) return;
    const { model, engine } = current;
    stop?.();
    const all = model.get("all-nodes");
    // from where the nodes are now: mid-animation, or after a drag
    const from = new Map(all.map((node) => [node.id, node.position]));
    const to = layoutPositions(all.map(boxOf), model.get("all-edges"));
    animating.value = true;
    stop = everyFrame(DURATION, (t) => {
        if (t < 1) {
            // a step of the animation: transient, as a drag's steps are
            model.run(
                "batch",
                { commands: movesTo(tween(from, to, t)) },
                { transient: true },
            );
            return;
        }
        // the exact places, once: the one change a history or a save keeps
        model.run("batch", { commands: movesTo(to) });
        stop = undefined;
        animating.value = false;
        layouts.value += 1;
        engine.run("fit-view", { ...FIT, duration: 300 });
    });
}

provide(ACTIONS, {
    add(parentId) {
        const model = flow.value?.model;
        const parent = model?.get("node-by", { id: parentId });
        if (!model || !parent) return;
        const number = counter++;
        const id = `topic-${number}`;
        const label = `Topic ${number}`;
        // the topic, its edge, its placeholder and that edge: one change
        model.run("batch", {
            commands: addChildCommands(parent, id, label),
        });
        relayout();
    },
    toggle(topicId) {
        const model = flow.value?.model;
        const topic = model?.get("node-by", { id: topicId });
        if (!model || !topic) return;
        const all = model.get("all-nodes");
        const collapsed = topicData(topic).collapsed !== true;
        const commands = toggleCommands(
            all,
            model.get("all-edges"),
            topicId,
            collapsed,
        );
        // the nodes an expand shows again start at their topic's place, then spread out
        const shown = commands.flatMap((entry) =>
            entry.command === "node.set-flags" && !entry.payload.hidden
                ? [entry.payload.nodeId]
                : [],
        );
        const starts = new Map(shown.map((id) => [id, topic.position]));
        // the flag, the hidden flags and the starting places: one change
        model.run("batch", {
            commands: [...commands, ...movesTo(starts)],
        });
        relayout();
    },
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
        aria-label="Auto layout"
        :data-animating="animating ? '' : undefined"
        :data-layouts="layouts"
        :class="styles.root"
    >
        <Flow.Background variant="dots" :size="2" :class="styles.dots" />
        <Flow.Background variant="lines" :class="styles.lines" />
        <Flow.Background variant="cross" :class="styles.cross" />
        <Flow.Viewport>
            <Flow.Edges v-slot="{ edge }">
                <TreeEdge :edge="edge" />
            </Flow.Edges>
            <Flow.Nodes v-slot="{ node }">
                <Flow.Node
                    v-if="node.type === 'add'"
                    :node="node"
                    :class="styles.placeholder"
                >
                    <Flow.Handle
                        type="target"
                        side="top"
                        :class="styles.placeholderHandle"
                    />
                    <AddButton :data="placeholderData(node)" />
                </Flow.Node>
                <Flow.Node
                    v-else
                    :node="node"
                    role="group"
                    aria-roledescription="node"
                    :aria-label="topicData(node).label"
                    :data-position="placeOf(node.position)"
                    :data-collapsed="topicData(node).collapsed ? '' : undefined"
                    :class="styles.node"
                >
                    <Flow.Handle type="target" side="top" :class="styles.handle" />
                    <span :class="styles.label">{{ topicData(node).label }}</span>
                    <Toggle :node="node" />
                    <Flow.Handle type="source" side="bottom" :class="styles.handle" />
                </Flow.Node>
            </Flow.Nodes>
        </Flow.Viewport>
    </Flow.Root>
</template>
