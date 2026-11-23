<script lang="ts">
import {
    type FlowJson,
    type FlowTypes,
    type Middleware,
    veto,
} from "@fragiola/flow-vue";
import { connection } from "@fragiola/flow-vue/connection";
import { drag } from "@fragiola/flow-vue/drag";
import { keyboard } from "@fragiola/flow-vue/keyboard";
import { selection } from "@fragiola/flow-vue/selection";

// No small dots to aim at: the whole node is its target, and its border its source. Each node has
// two handles as large as itself: an invisible target handle over all of it, and a source handle
// that is the ring around its body (press the body to drag the node, its border to connect). With
// `mode: "loose"` a connection may end at any handle of another node, and a drop snaps to the
// nearest handle within `radius`: a radius as large as half a node makes anywhere on a node a
// drop. With `clickToConnect`, a tap on a border starts a connection that follows the pointer, and
// a tap on another node ends it. On a touch screen (`pointer: coarse`) the ring grows. Both handles
// sit at the node's centre, so an edge is drawn as a floating line between the borders
// (`floating-edge.ts`, floating-edge.vue). A middleware refuses an edge from a node to itself.

export interface Types extends FlowTypes {
    readonly nodes: { step: { label: string } };
}

/** Every node's size: the floating edges cut their line at it. */
export const NODE = { width: 140, height: 56 };

export const features = [
    selection(),
    drag(),
    connection({
        mode: "loose",
        clickToConnect: true,
        // half a node's diagonal: a drop anywhere on it reaches its centre's handles
        radius: Math.ceil(Math.hypot(NODE.width, NODE.height) / 2) + 4,
        lineType: "straight",
    }),
    keyboard(),
] as const;

/** A node never connects to itself (its own handles are as near as any while you start). */
const noSelfLoop: Middleware<Types, typeof features> = (ctx, next) =>
    ctx.command === "edge.add" && ctx.payload.source === ctx.payload.target
        ? veto("a node does not connect to itself")
        : next();

const step = (id: string, label: string, x: number, y: number) => ({
    id,
    type: "step" as const,
    position: { x, y },
    ...NODE,
    data: { label },
});

const json: FlowJson<Types> = {
    version: 1,
    nodes: [
        step("idea", "Idea", 0, 0),
        step("sketch", "Sketch", 240, 0),
        step("build", "Build", 480, 0),
        step("test", "Test", 120, 170),
        step("ship", "Ship", 380, 170),
    ],
    edges: [{ id: "idea-sketch", source: "idea", target: "sketch" }],
};

/** The node's labels, for the edges' names. */
export const LABELS: Record<string, string> = Object.fromEntries(
    json.nodes.map((node) => [node.id, node.data.label]),
);

/** A handle as large as its node: the classes place it, not its side. */
const COVER = {
    top: undefined,
    left: undefined,
    transform: undefined,
};
</script>

<script setup lang="ts">
import { createFlowModel, typedFlow } from "@fragiola/flow-vue";
import FloatingEdge from "./floating-edge.vue";
import { styles } from "./styles";

const Flow = typedFlow<Types, typeof features>();

// the model is made once, with its middleware, and handed to the root
const model = createFlowModel<Types, typeof features>(json, { features });
model.use(noSelfLoop);
</script>

<template>
    <Flow.Root
        :model="model"
        :fit-view="{ padding: 0.2, maxZoom: 1 }"
        role="group"
        aria-label="Easy connect"
        :class="styles.root"
    >
        <Flow.Background variant="dots" :size="2" :class="styles.dots" />
        <Flow.Background variant="lines" :class="styles.lines" />
        <Flow.Background variant="cross" :class="styles.cross" />
        <Flow.Viewport>
            <Flow.Edges v-slot="{ edge }">
                <FloatingEdge :edge="edge" />
            </Flow.Edges>
            <Flow.Nodes v-slot="{ node }">
                <Flow.Node
                    :node="node"
                    role="group"
                    aria-roledescription="node"
                    :aria-label="node.data.label"
                    :class="styles.node"
                >
                    <Flow.Handle
                        type="target"
                        side="top"
                        :connectable-start="false"
                        :style="COVER"
                        :class="styles.target"
                    />
                    <Flow.Handle
                        type="source"
                        side="bottom"
                        :aria-label="`Connect from ${node.data.label}`"
                        :style="COVER"
                        :class="styles.source"
                    />
                    <div :class="styles.body">{{ node.data.label }}</div>
                </Flow.Node>
            </Flow.Nodes>
            <Flow.ConnectionLine :class="styles.connection" />
        </Flow.Viewport>
        <p :class="styles.hint">
            Drag from a node's border onto another node, or tap a border and then another node
        </p>
    </Flow.Root>
</template>
