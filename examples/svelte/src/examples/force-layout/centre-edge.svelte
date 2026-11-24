<!-- An edge from centre to centre (no handles: a force layout has no sides), under the nodes. -->
<script module lang="ts">
    /** A box's centre. */
    const centre = (rect: { x: number; y: number; width: number; height: number }) => ({
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
    });
</script>

<script lang="ts">
    import { type FlowEdge, straightPath, typedFlow, useInternalNode } from "@fragiola/flow-svelte";
    import { type features, labelOf, type Types } from "./index.svelte";
    import { styles } from "./styles";

    let { edge }: { edge: FlowEdge<Types> } = $props();

    const Flow = typedFlow<Types, typeof features>();
    // both nodes' boxes, followed while they move
    const source = useInternalNode<Types>(() => edge.source);
    const target = useInternalNode<Types>(() => edge.target);
    const path = $derived(
        source.current?.measured && target.current?.measured
            ? straightPath({
                  source: centre(source.current.rect),
                  target: centre(target.current.rect),
              }).path
            : undefined,
    );
</script>

{#if path}
    <Flow.Edge
        {edge}
        role="group"
        aria-roledescription="edge"
        aria-label={`${labelOf(edge.source)} to ${labelOf(edge.target)}`}
        class={styles.edgeGroup}
    >
        <Flow.EdgePath d={path} class={styles.edge} />
    </Flow.Edge>
{/if}
