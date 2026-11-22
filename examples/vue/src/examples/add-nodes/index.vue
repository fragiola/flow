<script lang="ts">
import type {
    FlowEngineEventOf,
    FlowNodeInput,
    FlowTypes,
} from "@fragiola/flow-vue";
import { connection } from "@fragiola/flow-vue/connection";
import { drag } from "@fragiola/flow-vue/drag";
import { selection } from "@fragiola/flow-vue/selection";
import { CircleIcon, DiamondIcon, SquareIcon } from "@lucide/vue";

// Adding nodes from outside the flow. The palette's items are dragged with the browser's own drag
// and drop: the root accepts the drop, and `engine.get("screen-to-flow", { x, y })` turns the
// drop's client point into flow coordinates, where `node.add` puts the node. A click on an item
// adds one at the centre of the view instead. `useFlowRef` (bound with `:flow-ref`) reaches the model
// and the engine from outside the root. A connection dropped on the canvas adds a task there,
// joined to where it came from: `@connect-cancel` tells where it ended (`point`, in flow
// coordinates) and from which handle (`from`), and `to` is empty when it ended over no handle.

const SHAPES = [
    { shape: "circle", label: "Start", icon: CircleIcon },
    { shape: "square", label: "Task", icon: SquareIcon },
    { shape: "diamond", label: "Decision", icon: DiamondIcon },
] as const;

type Shape = (typeof SHAPES)[number]["shape"];

interface Types extends FlowTypes {
    readonly nodes: { shape: { shape: Shape; label: string } };
}

const features = [selection(), drag(), connection()] as const;

const MIME = "application/x-flow-shape";

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "first",
        type: "shape",
        position: { x: 0, y: 0 },
        data: { shape: "circle", label: "Start" },
    },
];

let count = 0;
</script>

<script setup lang="ts">
import { typedFlow, useFlowRef } from "@fragiola/flow-vue";
import { styles } from "./styles";

const Flow = typedFlow<Types, typeof features>();
const flow = useFlowRef<Types, typeof features>();

/** Adds a node centred on a client point (a drop's, or the view's centre). */
function addAt(shape: Shape, client: { x: number; y: number }) {
    const current = flow.value;
    if (!current) return;
    const point = current.engine.get("screen-to-flow", client);
    const label = SHAPES.find((item) => item.shape === shape)?.label ?? shape;
    count += 1;
    current.model.run("node.add", {
        id: `${shape}-${count}`,
        type: "shape",
        // the node's top-left corner, so that its middle lands on the point
        position: { x: point.x - 50, y: point.y - 20 },
        data: { shape, label: `${label} ${count}` },
    });
}

function addAtCentre(shape: Shape, event: MouseEvent) {
    const button = event.currentTarget as HTMLElement;
    const root = button
        .closest("[data-testid=add-nodes]")
        ?.querySelector('[data-flow-part="root"]');
    const box = root?.getBoundingClientRect();
    if (box)
        addAt(shape, {
            x: box.x + box.width / 2,
            y: box.y + box.height / 2,
        });
}

/** A connection dropped over no handle: a new task there, joined to its start. */
function onConnectCancel(event: FlowEngineEventOf<"connect-cancel">) {
    const model = flow.value?.model;
    if (!model || !event.dropped || event.to || event.input !== "pointer")
        return;
    count += 1;
    const nodeId = `square-${count}`;
    model.run("batch", {
        commands: [
            {
                command: "node.add",
                payload: {
                    id: nodeId,
                    type: "shape",
                    position: { x: event.point.x - 50, y: event.point.y },
                    data: { shape: "square", label: `Task ${count}` },
                },
            },
            {
                command: "edge.add",
                payload:
                    event.from.type === "source"
                        ? { source: event.from.nodeId, target: nodeId }
                        : { source: nodeId, target: event.from.nodeId },
            },
        ],
    });
}

function onDragStart(shape: Shape, event: DragEvent) {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData(MIME, shape);
    event.dataTransfer.effectAllowed = "copy";
}

function onDragOver(event: DragEvent) {
    if (!event.dataTransfer?.types.includes(MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
}

function onDrop(event: DragEvent) {
    const shape = event.dataTransfer?.getData(MIME) as Shape;
    if (!SHAPES.some((item) => item.shape === shape)) return;
    event.preventDefault();
    addAt(shape, { x: event.clientX, y: event.clientY });
}
</script>

<template>
    <div data-testid="add-nodes" :class="styles.layout">
        <aside aria-label="Node palette" :class="styles.palette">
            <p :class="styles.paletteTitle">Drag or click</p>
            <button
                v-for="{ shape, label, icon } in SHAPES"
                :key="shape"
                type="button"
                draggable="true"
                :class="styles.item"
                @dragstart="onDragStart(shape, $event)"
                @click="addAtCentre(shape, $event)"
            >
                <component :is="icon" />
                {{ label }}
            </button>
        </aside>
        <Flow.Root
            :features="features"
            :default-nodes="nodes"
            :default-viewport="{ x: 160, y: 80, zoom: 1 }"
            :flow-ref="flow"
            :class="styles.root"
            @connect-cancel="onConnectCancel"
            @dragover="onDragOver"
            @drop="onDrop"
        >
            <Flow.Background variant="dots" :size="2" :class="styles.dots" />
            <Flow.Background variant="lines" :class="styles.lines" />
            <Flow.Background variant="cross" :class="styles.cross" />
            <Flow.Viewport>
                <Flow.Edges v-slot="{ edge }">
                    <Flow.Edge :edge="edge">
                        <Flow.EdgePath :class="styles.edge" />
                    </Flow.Edge>
                </Flow.Edges>
                <Flow.Nodes v-slot="{ node }">
                    <Flow.Node :node="node" :class="styles.shape(node.data.shape)">
                        {{ node.data.label }}
                        <Flow.Handle type="target" side="top" :class="styles.handle" />
                        <Flow.Handle type="source" side="bottom" :class="styles.handle" />
                    </Flow.Node>
                </Flow.Nodes>
                <Flow.ConnectionLine :class="styles.connection" />
            </Flow.Viewport>
        </Flow.Root>
    </div>
</template>
