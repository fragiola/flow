<!-- The actions over every editable edge: route them around the nodes, or straighten them. -->
<script lang="ts">
    import { type Rect, useFlow } from "@fragiola/flow-svelte";
    import { RouteIcon, SplineIcon } from "@lucide/svelte";
    import { type features, nameOf, type Types } from "./index.svelte";
    import { routeAround } from "./routing";
    import { styles } from "./styles";

    const flow = useFlow<Types, typeof features>();
    let status = $state("");

    function route() {
        const { model, engine } = flow;
        const obstacles = model
            .get("all-nodes")
            .map((node) => engine.get("node-rect-by", { nodeId: node.id }))
            .filter((rect): rect is Rect => rect !== undefined);
        const stuck: string[] = [];
        const commands = model.get("all-edges").flatMap((edge) => {
            const path = engine.get("edge-path-by", { edgeId: edge.id });
            if (!path) return [];
            const found = routeAround(
                {
                    point: path.source,
                    side: path.sourceSide,
                    node: engine.get("node-rect-by", { nodeId: edge.source }),
                },
                {
                    point: path.target,
                    side: path.targetSide,
                    node: engine.get("node-rect-by", { nodeId: edge.target }),
                },
                obstacles,
            );
            if (!found.found) stuck.push(nameOf(edge));
            return [
                {
                    command: "edge.set-data" as const,
                    payload: { edgeId: edge.id, data: { points: found.points } },
                },
            ];
        });
        model.run("batch", { commands });
        status =
            stuck.length === 0
                ? "Routed around the nodes."
                : `No way around for ${stuck.join(", ")}: a plain step stands in.`;
    }

    function clear() {
        flow.model.run("batch", {
            commands: flow.model.get("all-edges").map((edge) => ({
                command: "edge.set-data" as const,
                payload: { edgeId: edge.id, data: { points: [] } },
            })),
        });
        status = "The edges are straight.";
    }
</script>

<div class={styles.panel}>
    <div role="toolbar" aria-label="Edge actions" class={styles.actions}>
        <button type="button" onclick={route} class={styles.action}>
            <RouteIcon />
            Route
        </button>
        <button type="button" onclick={clear} class={styles.action}>
            <SplineIcon />
            Clear points
        </button>
    </div>
    <p class={styles.hint}>
        Double-click an edge to add a point, drag a point to bend it, Delete removes it.
    </p>
    <p role="status" class={styles.status}>{status}</p>
</div>
