<!--
    An animated edge: a dot travelling its path, dashes flowing along it, or one pulse when a value
    passes, each still under reduced motion but the pulse.
-->
<svelte:options namespace="svg" />

<script lang="ts">
    import { type FlowEdge, typedFlow, useEdge } from "@fragiola/flow-svelte";
    import { type features, LABELS, type Types } from "./index.svelte";
    import { DASH_PERIOD, describeMotion, travelSeconds } from "./motion";
    import { styles } from "./styles";

    let {
        edge,
        reduced,
        sending,
        onarrive,
    }: {
        edge: FlowEdge<Types>;
        reduced: boolean;
        sending: boolean;
        onarrive: () => void;
    } = $props();

    const Flow = typedFlow<Types, typeof features>();
    const own = useEdge<Types>(() => edge);
    const motion = $derived(edge.type === "animated" && edge.data ? edge.data.motion : "dash");
    const moving = $derived(motion !== "pulse" && !reduced);
    const pulsing = $derived(motion === "pulse" && sending);

    function onAnimationEnd(event: AnimationEvent) {
        // only the group's own pulse, not an animation inside it
        if (event.target === event.currentTarget && pulsing) onarrive();
    }
</script>

<Flow.Edge
    {edge}
    role="group"
    aria-roledescription="edge"
    aria-label={`${LABELS[edge.source]} to ${LABELS[edge.target]}: ${describeMotion(motion, reduced)}`}
    data-reduced-motion={motion !== "pulse" && reduced ? "" : undefined}
    data-pulsing={pulsing ? "" : undefined}
    onanimationend={onAnimationEnd}
    class={styles.edgeGroup}
>
    <!-- a wide transparent path: a bigger target for a click -->
    <Flow.EdgePath class={styles.edgeHit} />
    <Flow.EdgePath class={styles.edge(motion)}>
        {#if motion === "dash" && moving}
            <animate
                attributeName="stroke-dashoffset"
                from={DASH_PERIOD}
                to={0}
                dur="0.8s"
                repeatCount="indefinite"
            />
        {/if}
    </Flow.EdgePath>
    {#if motion === "travel" && moving && own.state.path}
        <circle r={6} data-testid="traveller" class={styles.traveller}>
            <animateMotion
                path={own.state.path.path}
                dur={`${travelSeconds(own.state.path.source, own.state.path.target)}s`}
                repeatCount="indefinite"
            />
        </circle>
    {/if}
</Flow.Edge>
