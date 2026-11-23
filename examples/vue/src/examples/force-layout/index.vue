<script lang="ts">
import type { FlowEdgeInput, FlowNodeInput, FlowTypes } from "@fragiola/flow-vue";
import { drag } from "@fragiola/flow-vue/drag";
import { selection } from "@fragiola/flow-vue/selection";
import type { InjectionKey, Ref } from "vue";
import { movesOf, type Point } from "./forces";

// A network laid out by a d3-force simulation (`forces.ts`): links pull the nodes they join
// together, every pair pushes apart, the boxes (their declared sizes) collide and the whole stays
// around the origin. On each of the simulation's ticks the nodes go to their new places in one
// transient `batch` of `node.move`; once it has cooled (`end`), one batch that is not transient
// keeps the places (one step for a history or a save), and the first time the view fits them.
// Dragging a node pins it: from `drag-start` (`@node-drag-start`) its body follows the node
// (`fx` / `fy`, read from the model on each tick, `engine.get("dragging-node-ids")`) and the
// simulation is reheated, so the others make room while it moves; the ticks never move a dragged
// node, or the drag and the simulation would fight. Dropped (`nodes-move`, `@nodes-move`) it stays
// pinned where it is; a cancelled drag releases it. "Restart" releases every pin and heats the
// simulation up again. The root carries `data-simulation` ("running" or "settled"), each node
// `data-position` and, pinned, `data-pinned` (service-node.vue); the edges run from centre to
// centre (centre-edge.vue). The simulation stops when the example is left.

export interface Types extends FlowTypes {
    readonly nodes: { service: { label: string } };
}

export const features = [selection(), drag()] as const;

/** Every node's declared box, in flow units; the hubs are bigger. */
const WIDTH = 120;
const HEIGHT = 40;
const HUB_WIDTH = 140;
const HUB_HEIGHT = 48;

/** How the view fits the network: some room around it, never zoomed in past 1. */
const FIT = { padding: 0.15, maxZoom: 1 };

/** The simulation's heat while a node is dragged: the others keep moving around it. */
const DRAG_HEAT = 0.3;

type Status = "running" | "settled";

/**
 * The network: a small web service in three clusters (the clients, the core services and their
 * stores, the background jobs), joined through the Gateway and the Queue. Each node starts near
 * its cluster's corner; the simulation spreads them out.
 */
const SERVICES: readonly (readonly [
    id: string,
    label: string,
    hub: boolean,
    x: number,
    y: number,
])[] = [
    ["web", "Web app", false, -420, -160],
    ["mobile", "Mobile app", false, -420, 40],
    ["cdn", "CDN", false, -560, -60],
    ["gateway", "Gateway", true, -260, -60],
    ["api", "API", true, -40, -60],
    ["auth", "Auth", false, 40, -220],
    ["users", "Users", false, 160, -120],
    ["orders", "Orders", false, 40, 80],
    ["db", "Database", false, 260, -20],
    ["cache", "Cache", false, 280, -200],
    ["queue", "Queue", true, 120, 240],
    ["mailer", "Mailer", false, -40, 380],
    ["billing", "Billing", false, 260, 380],
    ["reports", "Reports", false, 360, 260],
];

const LINKS: readonly (readonly [source: string, target: string])[] = [
    ["web", "cdn"],
    ["mobile", "cdn"],
    ["web", "gateway"],
    ["mobile", "gateway"],
    ["gateway", "api"],
    ["api", "auth"],
    ["api", "users"],
    ["api", "orders"],
    ["auth", "users"],
    ["users", "db"],
    ["users", "cache"],
    ["orders", "db"],
    ["orders", "queue"],
    ["queue", "mailer"],
    ["queue", "billing"],
    ["queue", "reports"],
    ["billing", "reports"],
];

const LABELS: Record<string, string> = Object.fromEntries(
    SERVICES.map(([id, label]) => [id, label]),
);

export const labelOf = (id: string) => LABELS[id] ?? id;

const nodes: FlowNodeInput<Types>[] = SERVICES.map(
    ([id, label, hub, x, y]) => ({
        id,
        type: "service",
        position: { x, y },
        width: hub ? HUB_WIDTH : WIDTH,
        height: hub ? HUB_HEIGHT : HEIGHT,
        data: { label },
    }),
);

const edges: FlowEdgeInput<Types>[] = LINKS.map(([source, target]) => ({
    id: `${source}-${target}`,
    source,
    target,
}));

/** What the simulation reads of a node: its id, place and declared size. */
const boxOf = (node: {
    id: string;
    position: Point;
    width?: number;
    height?: number;
}) => ({
    id: node.id,
    position: node.position,
    width: node.width ?? WIDTH,
    height: node.height ?? HEIGHT,
});

/** One `node.move` per payload, for a `batch`. */
const commandsOf = (moves: ReturnType<typeof movesOf>) =>
    moves.map((payload) => ({ command: "node.move" as const, payload }));

/** The nodes pinned in the simulation: dragged, or dropped and not released yet (service-node.vue). */
export const PINNED: InjectionKey<Readonly<Ref<ReadonlySet<string>>>> =
    Symbol("force-pinned");
</script>

<script setup lang="ts">
import {
    type FlowEngineEventOf,
    typedFlow,
    useFlowRef,
} from "@fragiola/flow-vue";
import { RotateCcwIcon } from "@lucide/vue";
import { onMounted, onUnmounted, provide, readonly, ref, shallowRef } from "vue";
import CentreEdge from "./centre-edge.vue";
import {
    createSimulation,
    type ForceNode,
    type ForceSimulation,
    isPinned,
    pinAt,
    toForceLinks,
    toForceNodes,
    unpin,
} from "./forces";
import ServiceNode from "./service-node.vue";
import { styles } from "./styles";

const Flow = typedFlow<Types, typeof features>();

/** The running simulation and its bodies by node id. */
interface Running {
    readonly simulation: ForceSimulation;
    readonly bodies: ReadonlyMap<string, ForceNode>;
}

const flow = useFlowRef<Types, typeof features>();
const status = ref<Status>("running");
const pinned = shallowRef<ReadonlySet<string>>(new Set());
provide(PINNED, readonly(pinned));

let running: Running | undefined;

// the simulation, once mounted (the model is there); leaving stops it
onMounted(() => {
    const current = flow.value;
    if (!current) return;
    const { model, engine } = current;
    const list = toForceNodes(model.get("all-nodes").map(boxOf));
    const bodies = new Map(list.map((body) => [body.id, body]));
    const simulation = createSimulation(
        list,
        toForceLinks(model.get("all-edges")),
    );
    let fitted = false;
    simulation.on("tick", () => {
        // a dragged node leads: its body follows it, and the tick leaves it to the drag
        const dragging = new Set(engine.get("dragging-node-ids"));
        for (const id of dragging) {
            const body = bodies.get(id);
            const node = model.get("node-by", { id });
            if (body && node) pinAt(body, node.position);
        }
        const commands = commandsOf(
            movesOf(
                list,
                (body) => dragging.has(body.id) || isPinned(body),
            ),
        );
        if (commands.length === 0) return;
        // a step of the simulation: transient, as a drag's steps are
        model.run("batch", { commands }, { transient: true });
    });
    simulation.on("end", () => {
        // the places it settled on, once: the one change a history or a save keeps
        const commands = commandsOf(movesOf(list, isPinned));
        if (commands.length > 0) model.run("batch", { commands });
        if (!fitted && engine.is("ready")) {
            fitted = true;
            engine.run("fit-view", FIT);
        }
        status.value = "settled";
    });
    running = { simulation, bodies };
    simulation.restart();
});

onUnmounted(() => {
    running?.simulation.stop();
    running = undefined;
});

/** Heats the simulation towards `target` and runs it (again). */
function heat(target: number) {
    if (!running) return;
    running.simulation.alphaTarget(target).restart();
    status.value = "running";
}

/** Pins `nodeIds` where the model has them now. */
function pinWhereTheyAre(nodeIds: readonly string[]) {
    const model = flow.value?.model;
    if (!running || !model) return;
    for (const id of nodeIds) {
        const body = running.bodies.get(id);
        const node = model.get("node-by", { id });
        if (body && node) pinAt(body, node.position);
    }
    pinned.value = new Set([...pinned.value, ...nodeIds]);
}

function onNodeDragStart(event: FlowEngineEventOf<"drag-start">) {
    pinWhereTheyAre(event.nodeIds);
    heat(DRAG_HEAT);
}

/** The drop: the nodes stay pinned where they are, and the simulation cools down. */
function onNodesMove(event: FlowEngineEventOf<"nodes-move">) {
    if (event.source !== "pointer") return;
    pinWhereTheyAre(event.nodeIds);
    heat(0);
}

/** A cancelled drag: the nodes went back, and the forces move them again from there. */
function onNodeDragCancel(event: FlowEngineEventOf<"drag-cancel">) {
    const model = flow.value?.model;
    if (!running || !model) return;
    for (const id of event.nodeIds) {
        const body = running.bodies.get(id);
        const node = model.get("node-by", { id });
        if (!body || !node) continue;
        pinAt(body, node.position);
        unpin(body);
    }
    const after = new Set(pinned.value);
    for (const id of event.nodeIds) after.delete(id);
    pinned.value = after;
    heat(0);
}

/** Releases every pin and heats the simulation up fully. */
function restart() {
    if (!running) return;
    for (const body of running.bodies.values()) unpin(body);
    pinned.value = new Set();
    running.simulation.alpha(1);
    heat(0);
}
</script>

<template>
    <Flow.Root
        :features="features"
        :default-nodes="nodes"
        :default-edges="edges"
        :fit-view="FIT"
        :flow-ref="flow"
        role="group"
        aria-label="Force layout"
        :data-simulation="status"
        :class="styles.root"
        @node-drag-start="onNodeDragStart"
        @nodes-move="onNodesMove"
        @node-drag-cancel="onNodeDragCancel"
    >
        <Flow.Background variant="dots" :size="2" :class="styles.dots" />
        <Flow.Background variant="lines" :class="styles.lines" />
        <Flow.Background variant="cross" :class="styles.cross" />
        <Flow.Viewport>
            <Flow.Edges v-slot="{ edge }">
                <CentreEdge :edge="edge" />
            </Flow.Edges>
            <Flow.Nodes v-slot="{ node }">
                <ServiceNode :node="node" />
            </Flow.Nodes>
        </Flow.Viewport>
        <div :class="styles.panel">
            <span role="status" :class="styles.status">
                {{ status === "running" ? "Simulating…" : "Settled" }}
            </span>
            <button type="button" :class="styles.button" @click="restart">
                <RotateCcwIcon aria-hidden="true" />
                Restart
            </button>
        </div>
    </Flow.Root>
</template>
