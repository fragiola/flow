<script setup lang="ts">
import { type FlowEdge, typedFlow, useEdge, useFlow } from "@fragiola/flow-vue";
import { computed, ref } from "vue";
import { movePoint, type Point, pathThrough, removePoint } from "./control-points";
import { type features, nameOf, pointsOf, type Types } from "./index.vue";
import { styles } from "./styles";

// An editable edge: drawn through its control points, each a control to drag, move with the
// arrows or remove with Delete.

const props = defineProps<{ edge: FlowEdge<Types> }>();

/** How far an arrow key moves a focused point (Shift: further). */
const STEP = 10;
const FAST_STEP = 50;

const ARROWS: Record<string, Point> = {
    ArrowUp: { x: 0, y: -1 },
    ArrowRight: { x: 1, y: 0 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
};

const Flow = typedFlow<Types, typeof features>();
const { model, engine } = useFlow<Types, typeof features>();
const { state } = useEdge<Types>(() => props.edge);
const dragging = ref<number | undefined>();
const points = computed(() => pointsOf(props.edge));
const name = computed(() => nameOf(props.edge));
const d = computed(() => {
    const path = state.value.path;
    return path ? pathThrough([path.source, ...points.value, path.target], 8) : "";
});

const save = (next: Point[]) =>
    model.run("edge.set-data", {
        edgeId: props.edge.id,
        data: { points: next },
    });

function onPointerDown(event: PointerEvent, index: number) {
    if (event.button !== 0) return;
    (event.currentTarget as SVGCircleElement).setPointerCapture(event.pointerId);
    dragging.value = index;
}

function onPointerMove(event: PointerEvent, index: number) {
    if (dragging.value !== index) return;
    const point = engine.get("screen-to-flow", {
        x: event.clientX,
        y: event.clientY,
    });
    if (point) save(movePoint(points.value, index, point));
}

function onKeyDown(event: KeyboardEvent, index: number) {
    const arrow = ARROWS[event.key];
    if (arrow) {
        event.preventDefault();
        const step = event.shiftKey ? FAST_STEP : STEP;
        const point = points.value[index] as Point;
        save(
            movePoint(points.value, index, {
                x: point.x + arrow.x * step,
                y: point.y + arrow.y * step,
            }),
        );
        return;
    }
    if (event.key !== "Delete" && event.key !== "Backspace") return;
    event.preventDefault();
    const group = (event.currentTarget as SVGCircleElement).closest(
        '[data-flow-part="edge"]',
    );
    save(removePoint(points.value, index));
    // focus stays on the edge: the point before, else the one now in its place, else the edge
    requestAnimationFrame(() => {
        const next =
            group?.querySelector<SVGElement>(`[data-point="${index - 1}"]`) ??
            group?.querySelector<SVGElement>(`[data-point="${index}"]`) ??
            (group as SVGElement | null);
        next?.focus();
    });
}
</script>

<template>
    <Flow.Edge
        v-if="state.path"
        :edge="edge"
        role="group"
        aria-roledescription="edge"
        :aria-label="name"
        :data-points="points.length"
        :class="styles.edgeGroup"
    >
        <!-- a wide transparent path: a bigger target for a click and a double click -->
        <Flow.EdgePath :d="d" :class="styles.edgeHit" />
        <Flow.EdgePath :d="d" :class="styles.edge" />
        <!-- SVG has no <button>: the circle is the control; a point's place is its identity -->
        <circle
            v-for="(point, index) in points"
            :key="index"
            :cx="point.x"
            :cy="point.y"
            :r="7"
            tabindex="0"
            role="button"
            aria-roledescription="control point"
            :aria-label="`Control point ${index + 1} of ${name}`"
            aria-keyshortcuts="ArrowUp ArrowRight ArrowDown ArrowLeft Delete Backspace"
            data-flow-no-gesture=""
            :data-point="index"
            :data-dragging="dragging === index ? '' : undefined"
            :class="styles.point"
            @pointerdown="onPointerDown($event, index)"
            @pointermove="onPointerMove($event, index)"
            @lostpointercapture="dragging = undefined"
            @keydown="onKeyDown($event, index)"
        />
    </Flow.Edge>
</template>
