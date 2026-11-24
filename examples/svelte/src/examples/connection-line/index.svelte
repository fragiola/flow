<script module lang="ts">
    import {
        type FlowJson,
        type FlowTypes,
        type Middleware,
        veto,
    } from "@fragiola/flow-svelte";
    import { connection } from "@fragiola/flow-svelte/connection";
    import { drag } from "@fragiola/flow-svelte/drag";
    import { keyboard } from "@fragiola/flow-svelte/keyboard";
    import { selection } from "@fragiola/flow-svelte/selection";

    // A connection line of the app's own: `Flow.ConnectionLine`'s `children` snippet (given the
    // connection) draws it, an elbow with a ring at its end (`multi-connection.ts`, lines.svelte),
    // and reads the line's `data-valid` / `data-invalid` to colour it (a locked node, or an edge
    // that exists already, is refused by a middleware). And a connection from several nodes at
    // once, which the library does not have: with several nodes selected (Shift-click), a drag from
    // one of their handles draws a line from each of them (the other lines come from
    // `useFlowStore`: the selection and each node's source handle), and when the drop adds the edge
    // (`connect`, `onconnect`) the example adds the others in one `batch`.

    export interface Types extends FlowTypes {
        readonly nodes: { device: { label: string; locked: boolean } };
    }

    export const features = [
        selection(),
        drag(),
        connection(),
        keyboard(),
    ] as const;

    /** Refuses an edge into a locked node, and an edge that exists already. */
    const rules: Middleware<Types, typeof features> = (ctx, next) => {
        if (ctx.command !== "edge.add") return next();
        const { source, target, targetHandle } = ctx.payload;
        const into = ctx.state.nodes.find((node) => node.id === target);
        if (into?.data.locked) return veto("a locked node takes no new edge");
        const taken = ctx.state.edges.some(
            (edge) =>
                edge.source === source &&
                edge.target === target &&
                edge.targetHandle === targetHandle,
        );
        return taken ? veto("that edge exists already") : next();
    };

    const device = (
        id: string,
        label: string,
        x: number,
        y: number,
        locked = false,
    ) => ({
        id,
        type: "device" as const,
        position: { x, y },
        width: 140,
        height: 48,
        data: { label, locked },
    });

    const json: FlowJson<Types> = {
        version: 1,
        nodes: [
            device("camera", "Camera", 0, 0),
            device("microphone", "Microphone", 0, 100),
            device("sensor", "Sensor", 0, 200),
            device("recorder", "Recorder", 380, 20),
            device("monitor", "Monitor", 380, 130),
            device("archive", "Archive (locked)", 380, 240, true),
        ],
        edges: [{ id: "camera-recorder", source: "camera", target: "recorder" }],
    };

    /** The node's labels, for the names. */
    const LABELS: Record<string, string> = Object.fromEntries(
        json.nodes.map((node) => [node.id, node.data.label]),
    );
    const labelOf = (id: string) => LABELS[id] ?? id;
</script>

<script lang="ts">
    import {
        createFlowModel,
        type FlowEngineEventOf,
        typedFlow,
    } from "@fragiola/flow-svelte";
    import Lines from "./lines.svelte";
    import { edgesToAdd, otherSources } from "./multi-connection";
    import { styles } from "./styles";

    const Flow = typedFlow<Types, typeof features>();
    // the model is made once, with its middleware, and handed to the root
    const model = createFlowModel<Types, typeof features>(json, { features });
    model.use(rules);
    let outcome = $state(
        "Shift-click nodes to select several, then drag from one of their handles.",
    );

    /** The drop added one edge: the other selected nodes get theirs, in one batch. */
    function onConnect(event: FlowEngineEventOf<"connect">) {
        const added = model.get("edge-by", { id: event.edgeId });
        const sources = otherSources(
            event.source,
            model.get("selected-nodes").map((node) => node.id),
        );
        const more = edgesToAdd(
            sources,
            event.target,
            added?.targetHandle,
            model.get("all-edges"),
        ).filter((edge) => model.can("edge.add", edge));
        if (more.length > 0) {
            model.run("batch", {
                commands: more.map((edge) => ({
                    command: "edge.add" as const,
                    payload: edge,
                })),
            });
        }
        const from = [event.source, ...more.map((edge) => edge.source)];
        outcome = `Connected ${from.map(labelOf).join(", ")} to ${labelOf(event.target)}.`;
    }

    function onConnectCancel(event: FlowEngineEventOf<"connect-cancel">) {
        if (event.refused) outcome = "Refused: that target takes no edge.";
    }
</script>

<Flow.Root
    {model}
    fitView={{ padding: 0.2, maxZoom: 1 }}
    onconnect={onConnect}
    onconnectcancel={onConnectCancel}
    role="group"
    aria-label="Connection line"
    class={styles.root}
>
    <Flow.Background variant="dots" size={2} class={styles.dots} />
    <Flow.Background variant="lines" class={styles.lines} />
    <Flow.Background variant="cross" class={styles.cross} />
    <Flow.Viewport>
        <Flow.Edges>
            {#snippet children(edge)}
                <Flow.Edge
                    {edge}
                    role="group"
                    aria-roledescription="edge"
                    aria-label={`${labelOf(edge.source)} to ${labelOf(edge.target)}`}
                    class={styles.edgeGroup}
                >
                    <Flow.EdgePath class={styles.edge} />
                </Flow.Edge>
            {/snippet}
        </Flow.Edges>
        <Flow.Nodes>
            {#snippet children(node)}
                <Flow.Node
                    {node}
                    role="group"
                    aria-roledescription="node"
                    aria-label={node.data.label}
                    class={styles.node(node.data.locked)}
                >
                    <Flow.Handle
                        type="target"
                        side="left"
                        aria-label={`Into ${node.data.label}`}
                        class={styles.handle}
                    />
                    {node.data.label}
                    <Flow.Handle
                        type="source"
                        side="right"
                        aria-label={`Connect from ${node.data.label}`}
                        class={styles.handle}
                    />
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
        <Flow.ConnectionLine class={styles.connection}>
            {#snippet children(line)}
                <Lines connection={line} />
            {/snippet}
        </Flow.ConnectionLine>
    </Flow.Viewport>
    <p role="status" data-testid="outcome" class={styles.status}>
        {outcome}
    </p>
</Flow.Root>
