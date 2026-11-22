<script lang="ts">
import type { FlowNodeInput, FlowTypes, XY } from "@fragiola/flow-vue";
import { drag } from "@fragiola/flow-vue/drag";
import { selection } from "@fragiola/flow-vue/selection";

// A context menu of your own. The root tells a right click (or the menu key) where it happened:
// `@node-context-menu` on a node, `@selection-context-menu` on one of several selected nodes,
// `@pane-context-menu` on the canvas, each with the client point (`client`), the flow point
// (`point`) and the DOM event, whose default the example prevents to show its menu instead of the
// browser's. The menu stands at the client point inside the frame; a click on the canvas, Escape,
// a pan or a choice closes it. `@node-double-click` marks a task done. These come from the
// engine's own taps: a right click that ended a pan opens nothing.

interface Types extends FlowTypes {
    readonly nodes: { task: { label: string; done: boolean } };
}

const features = [selection(), drag()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "plan",
        type: "task",
        position: { x: 0, y: 0 },
        data: { label: "Plan", done: false },
    },
    {
        id: "build",
        type: "task",
        position: { x: 200, y: 80 },
        data: { label: "Build", done: false },
    },
    {
        id: "ship",
        type: "task",
        position: { x: 400, y: 0 },
        data: { label: "Ship", done: false },
    },
];

/** What the menu acts on, and where it stands (relative to the frame). */
type Menu =
    | { kind: "node"; nodeId: string; at: XY }
    | { kind: "selection"; nodeIds: readonly string[]; at: XY }
    | { kind: "pane"; point: XY; at: XY };

let added = 0;
</script>

<script setup lang="ts">
import {
    type FlowEngineEventOf,
    typedFlow,
    useFlowRef,
} from "@fragiola/flow-vue";
import { nextTick, ref, shallowRef, watch } from "vue";
import { styles } from "./styles";

const Flow = typedFlow<Types, typeof features>();
const flow = useFlowRef<Types, typeof features>();
const frame = ref<HTMLDivElement | null>(null);
const menu = shallowRef<Menu | null>(null);
const first = ref<HTMLButtonElement | null>(null);

watch(menu, async (next) => {
    if (!next) return;
    await nextTick();
    first.value?.focus();
});

/** The menu's place: the client point, inside the frame. */
function at(client: XY): XY {
    const box = frame.value?.getBoundingClientRect();
    return { x: client.x - (box?.x ?? 0), y: client.y - (box?.y ?? 0) };
}

/** Opens a menu instead of the browser's. */
function open(
    event: { event: MouseEvent; client: XY },
    next: (where: XY) => Menu,
) {
    event.event.preventDefault();
    menu.value = next(at(event.client));
}

const onNode = (event: FlowEngineEventOf<"node-context-menu">) =>
    open(event, (where) => ({
        kind: "node",
        nodeId: event.nodeId,
        at: where,
    }));
const onSelection = (event: FlowEngineEventOf<"selection-context-menu">) =>
    open(event, (where) => ({
        kind: "selection",
        nodeIds: event.nodeIds,
        at: where,
    }));
const onPane = (event: FlowEngineEventOf<"pane-context-menu">) =>
    open(event, (where) => ({
        kind: "pane",
        point: event.point,
        at: where,
    }));

const close = () => {
    menu.value = null;
};
const model = () => flow.value?.model;

function onNodeDoubleClick(event: FlowEngineEventOf<"node-double-click">) {
    const node = model()?.get("node-by", { id: event.nodeId });
    if (node)
        model()?.run("node.set-data", {
            nodeId: node.id,
            data: { done: !node.data.done },
        });
}

function duplicate(nodeId: string) {
    const node = model()?.get("node-by", { id: nodeId });
    if (!node) return;
    added += 1;
    model()?.run("node.add", {
        id: `${nodeId}-copy-${added}`,
        type: "task",
        position: { x: node.position.x + 30, y: node.position.y + 60 },
        data: { label: `${node.data.label} copy`, done: false },
    });
    close();
}
function remove(nodeIds: readonly string[]) {
    model()?.run("batch", {
        commands: nodeIds.map((nodeId) => ({
            command: "node.remove" as const,
            payload: { nodeId },
        })),
    });
    close();
}
function addAt(point: XY) {
    added += 1;
    model()?.run("node.add", {
        id: `task-${added}`,
        type: "task",
        position: point,
        data: { label: `Task ${added}`, done: false },
    });
    close();
}
</script>

<template>
    <div ref="frame" :class="styles.frame">
        <Flow.Root
            :features="features"
            :default-nodes="nodes"
            :fit-view="{ padding: 0.3, maxZoom: 1 }"
            :flow-ref="flow"
            :class="styles.root"
            @node-context-menu="onNode"
            @selection-context-menu="onSelection"
            @pane-context-menu="onPane"
            @pane-click="close"
            @move-start="close"
            @node-double-click="onNodeDoubleClick"
        >
            <Flow.Background variant="dots" :size="2" :class="styles.dots" />
            <Flow.Background variant="lines" :class="styles.lines" />
            <Flow.Background variant="cross" :class="styles.cross" />
            <Flow.Viewport>
                <Flow.Nodes v-slot="{ node }">
                    <Flow.Node
                        :node="node"
                        role="group"
                        :aria-label="`${node.data.label}${node.data.done ? ', done' : ''}`"
                        :class="styles.node"
                    >
                        {{ node.data.done ? `✓ ${node.data.label}` : node.data.label }}
                        <Flow.Handle type="target" side="left" :class="styles.handle" />
                        <Flow.Handle type="source" side="right" :class="styles.handle" />
                    </Flow.Node>
                </Flow.Nodes>
            </Flow.Viewport>
        </Flow.Root>
        <div
            v-if="menu"
            role="menu"
            aria-label="Actions"
            tabindex="-1"
            :style="{ left: `${menu.at.x}px`, top: `${menu.at.y}px` }"
            :class="styles.menu"
            @keydown="(event: KeyboardEvent) => event.key === 'Escape' && close()"
        >
            <template v-if="menu.kind === 'node'">
                <button
                    ref="first"
                    type="button"
                    role="menuitem"
                    :class="styles.item"
                    @click="duplicate(menu.nodeId)"
                >
                    Duplicate
                </button>
                <button
                    type="button"
                    role="menuitem"
                    :class="styles.danger"
                    @click="remove([menu.nodeId])"
                >
                    Delete
                </button>
            </template>
            <button
                v-else-if="menu.kind === 'selection'"
                ref="first"
                type="button"
                role="menuitem"
                :class="styles.danger"
                @click="remove(menu.nodeIds)"
            >
                Delete {{ menu.nodeIds.length }} tasks
            </button>
            <button
                v-else
                ref="first"
                type="button"
                role="menuitem"
                :class="styles.item"
                @click="addAt(menu.point)"
            >
                Add a task here
            </button>
        </div>
    </div>
</template>
