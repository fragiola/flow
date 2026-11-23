<!-- An edge, marked while its path crosses a dragged node that is not one of its ends. -->
<script lang="ts">
    import { type FlowEdge, typedFlow, useFlowStore } from "@fragiola/flow-svelte";
    import { pathCrossesBox } from "./crossing";
    import { type features, labelOf, type Types } from "./index.svelte";
    import { styles } from "./styles";

    let { edge }: { edge: FlowEdge<Types> } = $props();

    const Flow = typedFlow<Types, typeof features>();
    const intersecting = useFlowStore<boolean, Types, typeof features>(
        ({ engine }) => {
            const { id, source, target } = edge;
            const dragging = engine
                .get("dragging-node-ids")
                .filter((nodeId) => nodeId !== source && nodeId !== target);
            if (dragging.length === 0) return false;
            const drawn = engine.get("edge-path-by", { edgeId: id });
            if (!drawn) return false;
            return dragging.some((nodeId) => {
                const box = engine.get("node-rect-by", { nodeId });
                return box !== undefined && box.width > 0
                    ? pathCrossesBox(drawn.path, box)
                    : false;
            });
        },
    );
</script>

<Flow.Edge
    {edge}
    role="group"
    aria-roledescription="edge"
    aria-label={`${labelOf(edge.source)} to ${labelOf(edge.target)}`}
    data-intersecting={intersecting.current ? "" : undefined}
    class={styles.edgeGroup}
>
    <Flow.EdgePath class={styles.edge} />
</Flow.Edge>
