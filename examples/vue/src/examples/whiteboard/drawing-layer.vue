<script lang="ts">
/** A drawn shape smaller than this (flow units) on either side is a slip, not a rectangle. */
const MIN_SIZE = 8;
/** How near (flow units) the eraser must pass to a node or an edge to wipe it. */
const REACH = 6;

let count = 0;
</script>

<script setup lang="ts">
import { useFlow } from "@fragiola/flow-vue";
import { computed, ref, shallowRef } from "vue";
import { type Segment, wiped } from "./eraser";
import type { features, Tool, Types } from "./index.vue";
import { insideLasso } from "./lasso";
import { addPoint, type Bounds, boundsOf, type Point, pathOf, smooth, strokeOf } from "./stroke";
import { styles } from "./styles";

// The layer a drawing tool draws on, over the flow: it takes the pointer, shows what is being
// drawn (in its own pixels) and, when the pointer is released, changes the flow through the model.

const props = defineProps<{ tool: Exclude<Tool, "select"> }>();
const emit = defineEmits<{
    erasing: [ids: ReadonlySet<string>];
    status: [status: string];
}>();

const { model, engine } = useFlow<Types, typeof features>();
// the pointer's client points, and the layer's corner when the press began
const points = shallowRef<Point[]>([]);
const corner = ref<Point>({ x: 0, y: 0 });
let wipe = { nodeIds: new Set<string>(), edgeIds: new Set<string>() };

const toFlow = (point: Point) => engine.get("screen-to-flow", point) ?? point;

/** The nodes' boxes, in flow coordinates. */
const boxes = () =>
    model.get("all-nodes").flatMap((node) => {
        const box = engine.get("node-rect-by", { nodeId: node.id });
        return box ? [{ id: node.id, box }] : [];
    });

/** Marks what the run from `from` to `to` (client points) wipes. */
function erase(from: Point, to: Point) {
    const lines = model.get("all-edges").flatMap((edge) => {
        const path = engine.get("edge-path-by", { edgeId: edge.id });
        return path ? [{ id: edge.id, line: { a: path.source, b: path.target } }] : [];
    });
    const run: Segment = { a: toFlow(from), b: toFlow(to) };
    const hit = wiped(run, { nodes: boxes(), edges: lines }, REACH);
    if (hit.nodeIds.length === 0 && hit.edgeIds.length === 0) return;
    for (const id of hit.nodeIds) wipe.nodeIds.add(id);
    for (const id of hit.edgeIds) wipe.edgeIds.add(id);
    emit("erasing", new Set([...wipe.nodeIds, ...wipe.edgeIds]));
}

function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    const layer = event.currentTarget as HTMLDivElement;
    layer.setPointerCapture(event.pointerId);
    const box = layer.getBoundingClientRect();
    corner.value = { x: box.x, y: box.y };
    const point = { x: event.clientX, y: event.clientY };
    wipe = { nodeIds: new Set(), edgeIds: new Set() };
    points.value = [point];
    if (props.tool === "eraser") erase(point, point);
}

function onPointerMove(event: PointerEvent) {
    const current = points.value;
    const last = current.at(-1);
    if (!last) return;
    const point = { x: event.clientX, y: event.clientY };
    if (props.tool === "rectangle") {
        points.value = [current[0] as Point, point];
        return;
    }
    const next = addPoint(current, point, 2);
    if (next.length === current.length) return;
    if (props.tool === "eraser") erase(last, point);
    points.value = next;
}

function finish() {
    if (points.value.length === 0) return;
    const flowPoints = points.value.map(toFlow);
    points.value = [];
    if (props.tool === "rectangle") {
        const box = boundsOf(flowPoints);
        if (!box || box.width < MIN_SIZE || box.height < MIN_SIZE) return;
        count += 1;
        model.run("node.add", {
            id: `rectangle-${count}`,
            type: "shape",
            position: { x: box.x, y: box.y },
            width: Math.round(box.width),
            height: Math.round(box.height),
            data: { label: `Rectangle ${count}` },
        });
        emit("status", `Rectangle ${count} drawn.`);
    } else if (props.tool === "freehand") {
        const stroke = strokeOf(flowPoints, 4);
        if (!stroke) return;
        count += 1;
        model.run("node.add", {
            id: `stroke-${count}`,
            type: "stroke",
            position: stroke.position,
            width: Math.round(stroke.width),
            height: Math.round(stroke.height),
            data: { label: `Stroke ${count}`, d: stroke.d },
        });
        emit("status", `Stroke ${count} drawn.`);
    } else if (props.tool === "eraser") {
        const { nodeIds, edgeIds } = wipe;
        wipe = { nodeIds: new Set(), edgeIds: new Set() };
        emit("erasing", new Set());
        const removed = nodeIds.size + edgeIds.size;
        if (removed === 0) return;
        // the edges first: a removed node takes its other edges with it
        model.run("batch", {
            commands: [
                ...[...edgeIds].map((edgeId) => ({
                    command: "edge.remove" as const,
                    payload: { edgeId },
                })),
                ...[...nodeIds].map((nodeId) => ({
                    command: "node.remove" as const,
                    payload: { nodeId },
                })),
            ],
        });
        emit("status", `Erased ${removed} ${removed === 1 ? "item" : "items"}.`);
    } else {
        const nodeIds = insideLasso(boxes(), flowPoints);
        model.run("selection.set", { nodeIds, edgeIds: [] });
        emit("status", `${nodeIds.length} ${nodeIds.length === 1 ? "node" : "nodes"} selected.`);
    }
}

function cancel() {
    points.value = [];
    wipe = { nodeIds: new Set(), edgeIds: new Set() };
    emit("erasing", new Set());
}

// what is being drawn, in the layer's own pixels
const local = computed(() =>
    points.value.map((point) => ({
        x: point.x - corner.value.x,
        y: point.y - corner.value.y,
    })),
);
const box = computed<Bounds | undefined>(() =>
    props.tool === "rectangle" ? boundsOf(local.value) : undefined,
);
</script>

<template>
    <div
        data-flow-no-gesture=""
        :data-drawing="points.length > 0 ? '' : undefined"
        :class="styles.layer"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="finish"
        @pointercancel="cancel"
    >
        <svg aria-hidden="true" :class="styles.preview">
            <rect
                v-if="box"
                :x="box.x"
                :y="box.y"
                :width="box.width"
                :height="box.height"
                :class="styles.previewRect"
            />
            <path
                v-if="tool === 'freehand' && local.length > 1"
                :d="pathOf(smooth(local))"
                :class="styles.previewStroke"
            />
            <path
                v-if="tool === 'eraser' && local.length > 1"
                :d="pathOf(local)"
                :class="styles.previewTrail"
            />
            <path
                v-if="tool === 'lasso' && local.length > 1"
                :d="`${pathOf(local)} Z`"
                :class="styles.previewLasso"
            />
        </svg>
    </div>
</template>
