<!-- The app's own edge type: its path drawn from the edge's ends. -->
<script module lang="ts">
    import type { EdgePath } from "@fragiola/flow-svelte";

    /** A wave between the two ends: a sine of `amplitude` pixels across the straight line. */
    function wavePath(path: EdgePath, amplitude: number): string {
        const { source, target } = path;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const length = Math.hypot(dx, dy) || 1;
        // the unit normal to the line
        const nx = -dy / length;
        const ny = dx / length;
        const waves = Math.max(1, Math.round(length / 60));
        const steps = waves * 16;
        const points: string[] = [];
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const offset = Math.sin(t * waves * 2 * Math.PI) * amplitude;
            points.push(`${source.x + dx * t + nx * offset},${source.y + dy * t + ny * offset}`);
        }
        return `M ${points.join(" L ")}`;
    }
</script>

<script lang="ts">
    import { type FlowEdge, typedFlow, useEdge } from "@fragiola/flow-svelte";
    import type { features, Types } from "./index.svelte";
    import { styles } from "./styles";

    let { edge }: { edge: Extract<FlowEdge<Types>, { type?: "wave" }> } = $props();

    const Flow = typedFlow<Types, typeof features>();
    const own = useEdge<Types>(() => edge);
</script>

{#if own.state.path}
    <Flow.Edge {edge}>
        <Flow.EdgePath d={wavePath(own.state.path, edge.data?.amplitude ?? 8)} class={styles.edge} />
        <Flow.EdgeLabel class={styles.label}>wave (app)</Flow.EdgeLabel>
    </Flow.Edge>
{/if}
