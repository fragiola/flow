<!--
    An editable edge: drawn through its control points, each a control to drag, move with the
    arrows or remove with Delete.
-->
<svelte:options namespace="svg" />

<script module lang="ts">
    import type { Point } from "./control-points";

    /** How far an arrow key moves a focused point (Shift: further). */
    const STEP = 10;
    const FAST_STEP = 50;

    const ARROWS: Record<string, Point> = {
        ArrowUp: { x: 0, y: -1 },
        ArrowRight: { x: 1, y: 0 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
    };
</script>

<script lang="ts">
    import { type FlowEdge, typedFlow, useEdge, useFlow } from "@fragiola/flow-svelte";
    import { movePoint, pathThrough, removePoint } from "./control-points";
    import { type features, nameOf, pointsOf, type Types } from "./index.svelte";
    import { styles } from "./styles";

    let { edge }: { edge: Extract<FlowEdge<Types>, { type?: "editable" }> } = $props();

    const Flow = typedFlow<Types, typeof features>();
    const flow = useFlow<Types, typeof features>();
    const own = useEdge<Types>(() => edge);
    let dragging = $state<number | undefined>();
    const points = $derived(pointsOf(edge));
    const name = $derived(nameOf(edge));
    const d = $derived.by(() => {
        const path = own.state.path;
        return path ? pathThrough([path.source, ...points, path.target], 8) : "";
    });

    const save = (next: Point[]) =>
        flow.model.run("edge.set-data", { edgeId: edge.id, data: { points: next } });

    function onPointerDown(event: PointerEvent, index: number) {
        if (event.button !== 0) return;
        (event.currentTarget as SVGCircleElement).setPointerCapture(event.pointerId);
        dragging = index;
    }

    function onPointerMove(event: PointerEvent, index: number) {
        if (dragging !== index) return;
        const point = flow.engine.get("screen-to-flow", { x: event.clientX, y: event.clientY });
        if (point) save(movePoint(points, index, point));
    }

    function onKeyDown(event: KeyboardEvent, index: number) {
        const arrow = ARROWS[event.key];
        if (arrow) {
            event.preventDefault();
            const step = event.shiftKey ? FAST_STEP : STEP;
            const point = points[index] as Point;
            save(
                movePoint(points, index, {
                    x: point.x + arrow.x * step,
                    y: point.y + arrow.y * step,
                }),
            );
            return;
        }
        if (event.key !== "Delete" && event.key !== "Backspace") return;
        event.preventDefault();
        const group = (event.currentTarget as SVGCircleElement).closest('[data-flow-part="edge"]');
        save(removePoint(points, index));
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

{#if own.state.path}
    <Flow.Edge
        {edge}
        role="group"
        aria-roledescription="edge"
        aria-label={name}
        data-points={points.length}
        class={styles.edgeGroup}
    >
        <!-- a wide transparent path: a bigger target for a click and a double click -->
        <Flow.EdgePath {d} class={styles.edgeHit} />
        <Flow.EdgePath {d} class={styles.edge} />
        <!-- SVG has no <button>: the circle is the control; a point's place is its identity -->
        {#each points as point, index (index)}
            <circle
                cx={point.x}
                cy={point.y}
                r={7}
                tabindex="0"
                role="button"
                aria-roledescription="control point"
                aria-label={`Control point ${index + 1} of ${name}`}
                aria-keyshortcuts="ArrowUp ArrowRight ArrowDown ArrowLeft Delete Backspace"
                data-flow-no-gesture=""
                data-point={index}
                data-dragging={dragging === index ? "" : undefined}
                onpointerdown={(event) => onPointerDown(event, index)}
                onpointermove={(event) => onPointerMove(event, index)}
                onlostpointercapture={() => (dragging = undefined)}
                onkeydown={(event) => onKeyDown(event, index)}
                class={styles.point}
            />
        {/each}
    </Flow.Edge>
{/if}
