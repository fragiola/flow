<!--
    The connection line's drawing, in flow coordinates: an elbow from the pressed handle, one from
    each other selected node's source handle, and a ring where they meet.
-->
<svelte:options namespace="svg" />

<script lang="ts">
    import { type Connection, useFlowStore } from "@fragiola/flow-svelte";
    import type { features, Types } from "./index.svelte";
    import { elbowPath, otherSources, type Start, sameStarts } from "./multi-connection";
    import { styles } from "./styles";

    let { connection }: { connection: Connection } = $props();

    const starts = useFlowStore<readonly Start[], Types, typeof features>(
        ({ model, engine }) =>
            otherSources(
                connection.from.nodeId,
                model.get("selected-nodes").map((node) => node.id),
            ).flatMap((nodeId) => {
                const center = engine
                    .get("handles-by", { nodeId })
                    .find((handle) => handle.type === "source")?.center;
                return center ? [{ id: nodeId, ...center }] : [];
            }),
        sameStarts,
    );
</script>

{#each starts.current as start (start.id)}
    <path
        data-testid="extra-line"
        data-source={start.id}
        d={elbowPath(start, connection.toPoint)}
        class={styles.extra}
    />
{/each}
<path
    data-testid="custom-line"
    d={elbowPath(connection.fromPoint, connection.toPoint)}
    class={styles.line}
/>
<circle cx={connection.toPoint.x} cy={connection.toPoint.y} r={5} class={styles.end} />
