<script lang="ts">
/** The knob's arrow step, and Shift's snap while dragging it (degrees). */
const STEP = 15;
</script>

<script setup lang="ts">
import { useFlow } from "@fragiola/flow-vue";
import type { features, Node, Types } from "./index.vue";
import { angleFrom, normalizeAngle } from "./rotation";
import { styles } from "./styles";

// The knob above the node: dragging it turns the node around its centre (`node.set-data` with the
// angle, transient while it moves), the arrows by a step, Home back to 0.

const props = defineProps<{
    node: Node;
    /** The node's turned content, whose centre the knob turns around. */
    frame: () => HTMLElement | null;
}>();

const { model } = useFlow<Types, typeof features>();
let turning = false;

function rotate(angle: number, transient: boolean) {
    model.run(
        "node.set-data",
        { nodeId: props.node.id, data: { angle } },
        { transient },
    );
}

function angleAt(event: PointerEvent): number {
    const box = props.frame()?.getBoundingClientRect();
    if (!box) return props.node.data.angle;
    // the content turns around its centre, which a turn does not move
    const center = {
        x: box.left + box.width / 2,
        y: box.top + box.height / 2,
    };
    return angleFrom(
        center,
        { x: event.clientX, y: event.clientY },
        event.shiftKey ? STEP : 1,
    );
}

function onPointerDown(event: PointerEvent) {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    turning = true;
}

function onPointerMove(event: PointerEvent) {
    if (turning) rotate(angleAt(event), true);
}

function onPointerUp(event: PointerEvent) {
    if (!turning) return;
    turning = false;
    rotate(angleAt(event), false);
}

function onPointerCancel() {
    turning = false;
}

function onKeyDown(event: KeyboardEvent) {
    const by =
        event.key === "ArrowRight" || event.key === "ArrowUp"
            ? STEP
            : event.key === "ArrowLeft" || event.key === "ArrowDown"
              ? -STEP
              : undefined;
    if (event.key === "Home") rotate(0, false);
    else if (by !== undefined)
        rotate(normalizeAngle(props.node.data.angle + by), false);
    else return;
    event.preventDefault();
}
</script>

<template>
    <div
        role="slider"
        tabindex="0"
        :aria-label="`Rotate ${node.data.label}`"
        :aria-valuemin="0"
        :aria-valuemax="359"
        :aria-valuenow="node.data.angle"
        :aria-valuetext="`${node.data.angle} degrees`"
        data-flow-no-gesture=""
        :class="styles.rotate"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerCancel"
        @keydown="onKeyDown"
    />
</template>
