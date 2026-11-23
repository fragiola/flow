<script lang="ts">
    import { useFlowStore } from "@fragiola/flow-svelte";
    import { type features, linkFor, type Types } from "./index.svelte";
    import { type Link, sameLink } from "./proximity";
    import { styles } from "./styles";

    // The temporary edge: a dashed line in flow coordinates, inside the viewport, while the dragged
    // node is near another. Not a `Flow.Edge`: it is not in the document, nor focusable.

    let { nodeId }: { nodeId: string } = $props();

    const link = useFlowStore<Link | undefined, Types, typeof features>(
        ({ model, engine }) => linkFor(model, engine, nodeId),
        sameLink,
    );
</script>

{#if link.current}
    <svg aria-hidden="true" class={styles.overlay}>
        <line
            data-testid="temporary-edge"
            data-source={link.current.source}
            data-target={link.current.target}
            x1={link.current.from.x}
            y1={link.current.from.y}
            x2={link.current.to.x}
            y2={link.current.to.y}
            class={styles.temporary}
        />
    </svg>
{/if}
