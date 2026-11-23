<!-- A node, marked while a dragged node overlaps it. -->
<script lang="ts">
    import { type FlowNode, typedFlow, useFlowStore } from "@fragiola/flow-svelte";
    import type { features, Types } from "./index.svelte";
    import { styles } from "./styles";

    let { node }: { node: FlowNode<Types> } = $props();

    const Flow = typedFlow<Types, typeof features>();
    const intersecting = useFlowStore<boolean, Types, typeof features>(
        ({ engine }) => {
            const dragging = engine.get("dragging-node-ids");
            if (dragging.length === 0 || dragging.includes(node.id)) {
                return false;
            }
            return engine
                .get("intersecting-nodes", { nodeId: node.id })
                .some((other) => dragging.includes(other.id));
        },
    );
</script>

<Flow.Node
    {node}
    role="group"
    aria-roledescription="node"
    aria-label={node.data.label}
    data-intersecting={intersecting.current ? "" : undefined}
    class={styles.node}
>
    <Flow.Handle type="target" side="left" class={styles.handle} />
    {node.data.label}
    <Flow.Handle type="source" side="right" class={styles.handle} />
</Flow.Node>
