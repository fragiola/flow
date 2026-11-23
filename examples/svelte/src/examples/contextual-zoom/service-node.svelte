<!-- A service: its name; from medium detail its kind and health; at high its owner and figures. -->
<script lang="ts">
    import { type FlowNode, typedFlow, useFlowStore } from "@fragiola/flow-svelte";
    import { Badge } from "#/components/atoms/badge";
    import { atLeast, type Detail, detailOf } from "./detail";
    import type { features, Types } from "./index.svelte";
    import { styles } from "./styles";

    let { node }: { node: FlowNode<Types> } = $props();

    const Flow = typedFlow<Types, typeof features>();
    // the detail level at the current zoom; updates only when the level changes
    const detail = useFlowStore<Detail, Types, typeof features>(({ engine }) =>
        detailOf(engine.get("viewport").zoom),
    );
</script>

<Flow.Node
    {node}
    role="group"
    aria-roledescription="service"
    aria-label={node.data.label}
    data-detail={detail.current}
    class={styles.node}
>
    <Flow.Handle type="target" side="left" class={styles.handle} />
    <span class={styles.title}>{node.data.label}</span>
    {#if atLeast(detail.current, "medium")}
        <span class={styles.summary}>
            <span>{node.data.kind}</span>
            <Badge variant="soft" class={styles.health(node.data.health)}>
                {node.data.health}
            </Badge>
        </span>
    {/if}
    {#if atLeast(detail.current, "high")}
        <dl class={styles.facts}>
            <dt class={styles.term}>Owner</dt>
            <dd>{node.data.owner}</dd>
            <dt class={styles.term}>Load</dt>
            <dd>{node.data.requests}</dd>
            <dt class={styles.term}>p95</dt>
            <dd>{node.data.latency}</dd>
        </dl>
    {/if}
    <Flow.Handle type="source" side="right" class={styles.handle} />
</Flow.Node>
