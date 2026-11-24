<!-- An edge stroked with a `<linearGradient>` of its own, drawn in flow coordinates between its ends. -->
<svelte:options namespace="svg" />

<script lang="ts">
    import { type FlowEdge, typedFlow, useEdge } from "@fragiola/flow-svelte";
    import { edgeGradient, gradientId, gradientUrl } from "./gradients";
    import { type features, STEPS, type Types } from "./index.svelte";
    import { styles } from "./styles";

    let { edge, prefix }: { edge: FlowEdge<Types>; prefix: string } = $props();

    const Flow = typedFlow<Types, typeof features>();
    const own = useEdge<Types>(() => edge);
    const source = $derived(STEPS[edge.source]);
    const target = $derived(STEPS[edge.target]);
    const gradient = $derived(
        edgeGradient(source?.kind ?? "transform", target?.kind ?? "transform"),
    );
    const ends = $derived(own.state.path);
</script>

<Flow.Edge
    {edge}
    role="group"
    aria-roledescription="edge"
    aria-label={`${source?.label} to ${target?.label}`}
    class={styles.edgeGroup}
>
    <defs>
        <linearGradient
            id={gradientId(prefix, edge.id)}
            gradientUnits="userSpaceOnUse"
            x1={ends?.source.x}
            y1={ends?.source.y}
            x2={ends?.target.x}
            y2={ends?.target.y}
        >
            <stop offset="0%" class={styles.stop(gradient.from)} />
            <stop offset="100%" class={styles.stop(gradient.to)} />
        </linearGradient>
    </defs>
    <!-- a wide transparent path: a bigger target for a click -->
    <Flow.EdgePath class={styles.edgeHit} />
    <Flow.EdgePath stroke={gradientUrl(prefix, edge.id)} class={styles.edge} />
</Flow.Edge>
