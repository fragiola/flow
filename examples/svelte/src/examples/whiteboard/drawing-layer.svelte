<!--
    The layer a drawing tool draws on, over the flow: it takes the pointer, shows what is being
    drawn (in its own pixels) and, when the pointer is released, changes the flow through the model.
-->
<script module lang="ts">
    /** A drawn shape smaller than this (flow units) on either side is a slip, not a rectangle. */
    const MIN_SIZE = 8;
    /** How near (flow units) the eraser must pass to a node or an edge to wipe it. */
    const REACH = 6;

    let count = 0;
</script>

<script lang="ts">
    import { useFlow } from "@fragiola/flow-svelte";
    import { type Segment, wiped } from "./eraser";
    import type { features, Tool, Types } from "./index.svelte";
    import { insideLasso } from "./lasso";
    import { addPoint, type Bounds, boundsOf, type Point, pathOf, smooth, strokeOf } from "./stroke";
    import { styles } from "./styles";

    let {
        tool,
        onerasing,
        onstatus,
    }: {
        tool: Exclude<Tool, "select">;
        onerasing: (ids: ReadonlySet<string>) => void;
        onstatus: (status: string) => void;
    } = $props();

    const flow = useFlow<Types, typeof features>();
    // the pointer's client points, and the layer's corner when the press began
    let points = $state.raw<Point[]>([]);
    let corner = $state.raw<Point>({ x: 0, y: 0 });
    let wipe = { nodeIds: new Set<string>(), edgeIds: new Set<string>() };

    const toFlow = (point: Point) => flow.engine.get("screen-to-flow", point) ?? point;

    /** The nodes' boxes, in flow coordinates. */
    const boxes = () =>
        flow.model.get("all-nodes").flatMap((node) => {
            const box = flow.engine.get("node-rect-by", { nodeId: node.id });
            return box ? [{ id: node.id, box }] : [];
        });

    /** Marks what the run from `from` to `to` (client points) wipes. */
    function erase(from: Point, to: Point) {
        const lines = flow.model.get("all-edges").flatMap((edge) => {
            const path = flow.engine.get("edge-path-by", { edgeId: edge.id });
            return path ? [{ id: edge.id, line: { a: path.source, b: path.target } }] : [];
        });
        const run: Segment = { a: toFlow(from), b: toFlow(to) };
        const hit = wiped(run, { nodes: boxes(), edges: lines }, REACH);
        if (hit.nodeIds.length === 0 && hit.edgeIds.length === 0) return;
        for (const id of hit.nodeIds) wipe.nodeIds.add(id);
        for (const id of hit.edgeIds) wipe.edgeIds.add(id);
        onerasing(new Set([...wipe.nodeIds, ...wipe.edgeIds]));
    }

    function onPointerDown(event: PointerEvent & { currentTarget: HTMLDivElement }) {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        const box = event.currentTarget.getBoundingClientRect();
        corner = { x: box.x, y: box.y };
        const point = { x: event.clientX, y: event.clientY };
        wipe = { nodeIds: new Set(), edgeIds: new Set() };
        points = [point];
        if (tool === "eraser") erase(point, point);
    }

    function onPointerMove(event: PointerEvent) {
        const last = points.at(-1);
        if (!last) return;
        const point = { x: event.clientX, y: event.clientY };
        if (tool === "rectangle") {
            points = [points[0] as Point, point];
            return;
        }
        const next = addPoint(points, point, 2);
        if (next.length === points.length) return;
        if (tool === "eraser") erase(last, point);
        points = next;
    }

    function finish() {
        if (points.length === 0) return;
        const flowPoints = points.map(toFlow);
        points = [];
        if (tool === "rectangle") {
            const box = boundsOf(flowPoints);
            if (!box || box.width < MIN_SIZE || box.height < MIN_SIZE) return;
            count += 1;
            flow.model.run("node.add", {
                id: `rectangle-${count}`,
                type: "shape",
                position: { x: box.x, y: box.y },
                width: Math.round(box.width),
                height: Math.round(box.height),
                data: { label: `Rectangle ${count}` },
            });
            onstatus(`Rectangle ${count} drawn.`);
        } else if (tool === "freehand") {
            const stroke = strokeOf(flowPoints, 4);
            if (!stroke) return;
            count += 1;
            flow.model.run("node.add", {
                id: `stroke-${count}`,
                type: "stroke",
                position: stroke.position,
                width: Math.round(stroke.width),
                height: Math.round(stroke.height),
                data: { label: `Stroke ${count}`, d: stroke.d },
            });
            onstatus(`Stroke ${count} drawn.`);
        } else if (tool === "eraser") {
            const { nodeIds, edgeIds } = wipe;
            wipe = { nodeIds: new Set(), edgeIds: new Set() };
            onerasing(new Set());
            const removed = nodeIds.size + edgeIds.size;
            if (removed === 0) return;
            // the edges first: a removed node takes its other edges with it
            flow.model.run("batch", {
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
            onstatus(`Erased ${removed} ${removed === 1 ? "item" : "items"}.`);
        } else {
            const nodeIds = insideLasso(boxes(), flowPoints);
            flow.model.run("selection.set", { nodeIds, edgeIds: [] });
            onstatus(`${nodeIds.length} ${nodeIds.length === 1 ? "node" : "nodes"} selected.`);
        }
    }

    function cancel() {
        points = [];
        wipe = { nodeIds: new Set(), edgeIds: new Set() };
        onerasing(new Set());
    }

    // what is being drawn, in the layer's own pixels
    const local = $derived(
        points.map((point) => ({ x: point.x - corner.x, y: point.y - corner.y })),
    );
    const box = $derived<Bounds | undefined>(tool === "rectangle" ? boundsOf(local) : undefined);
</script>

<!-- a pointer surface, as React's and Vue's (no role): what it does is told by the status -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    data-flow-no-gesture=""
    data-drawing={points.length > 0 ? "" : undefined}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={finish}
    onpointercancel={cancel}
    class={styles.layer}
>
    <svg aria-hidden="true" class={styles.preview}>
        {#if box}
            <rect
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                class={styles.previewRect}
            />
        {/if}
        {#if tool === "freehand" && local.length > 1}
            <path d={pathOf(smooth(local))} class={styles.previewStroke} />
        {/if}
        {#if tool === "eraser" && local.length > 1}
            <path d={pathOf(local)} class={styles.previewTrail} />
        {/if}
        {#if tool === "lasso" && local.length > 1}
            <path d={`${pathOf(local)} Z`} class={styles.previewLasso} />
        {/if}
    </svg>
</div>
