<script module lang="ts">
    /** The knob's arrow step, and Shift's snap while dragging it (degrees). */
    const STEP = 15;
</script>

<script lang="ts">
    import { useFlow } from "@fragiola/flow-svelte";
    import type { features, Node, Types } from "./index.svelte";
    import { angleFrom, normalizeAngle } from "./rotation";
    import { styles } from "./styles";

    // The knob above the node: dragging it turns the node around its centre (`node.set-data` with
    // the angle, transient while it moves), the arrows by a step, Home back to 0.

    let {
        node,
        frame,
    }: {
        node: Node;
        /** The node's turned content, whose centre the knob turns around. */
        frame: () => HTMLElement | null;
    } = $props();

    const flow = useFlow<Types, typeof features>();
    let turning = false;

    function rotate(angle: number, transient: boolean): void {
        flow.model.run("node.set-data", { nodeId: node.id, data: { angle } }, { transient });
    }

    function angleAt(event: PointerEvent): number {
        const box = frame()?.getBoundingClientRect();
        if (!box) return node.data.angle;
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

    function onpointerdown(event: PointerEvent & { currentTarget: HTMLDivElement }): void {
        event.currentTarget.setPointerCapture(event.pointerId);
        turning = true;
    }

    function onpointermove(event: PointerEvent): void {
        if (turning) rotate(angleAt(event), true);
    }

    function onpointerup(event: PointerEvent): void {
        if (!turning) return;
        turning = false;
        rotate(angleAt(event), false);
    }

    function onkeydown(event: KeyboardEvent): void {
        const by =
            event.key === "ArrowRight" || event.key === "ArrowUp"
                ? STEP
                : event.key === "ArrowLeft" || event.key === "ArrowDown"
                  ? -STEP
                  : undefined;
        if (event.key === "Home") rotate(0, false);
        else if (by !== undefined) rotate(normalizeAngle(node.data.angle + by), false);
        else return;
        event.preventDefault();
    }
</script>

<div
    role="slider"
    tabindex="0"
    aria-label={`Rotate ${node.data.label}`}
    aria-valuemin={0}
    aria-valuemax={359}
    aria-valuenow={node.data.angle}
    aria-valuetext={`${node.data.angle} degrees`}
    data-flow-no-gesture=""
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    onpointercancel={() => (turning = false)}
    {onkeydown}
    class={styles.rotate}
></div>
