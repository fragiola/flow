<script module lang="ts">
    import type {
        FlowEdgeInput,
        FlowEngineEvent,
        FlowModel,
        FlowNodeInput,
        FlowTypes,
    } from "@fragiola/flow-svelte";
    import { connection } from "@fragiola/flow-svelte/connection";
    import { drag } from "@fragiola/flow-svelte/drag";
    import { keyboard } from "@fragiola/flow-svelte/keyboard";
    import { selection } from "@fragiola/flow-svelte/selection";

    // The package says nothing aloud: it has no text. The engine tells what happened
    // (`engine.subscribe`: nodes moved, an edge connected, something removed), and the app writes
    // it, in its own words and language, into a live region a screen reader reads
    // (`role="status"`). The log beside it shows the same messages. Try it with the keyboard: Tab
    // to a node, move it with the arrows, delete it with Delete; or Tab to a handle and press
    // Enter: each target the connection points at is announced (`connect-target`, its `index` of
    // `count`) until Enter connects.

    interface Types extends FlowTypes {
        readonly nodes: { room: { label: string } };
    }

    const features = [selection(), drag(), connection(), keyboard()] as const;

    const nodes: FlowNodeInput<Types>[] = [
        {
            id: "hall",
            type: "room",
            position: { x: 0, y: 0 },
            data: { label: "Hall" },
        },
        {
            id: "kitchen",
            type: "room",
            position: { x: 220, y: 0 },
            data: { label: "Kitchen" },
        },
        {
            id: "garden",
            type: "room",
            position: { x: 110, y: 140 },
            data: { label: "Garden" },
        },
    ];

    const edges: FlowEdgeInput<Types>[] = [
        { id: "hall-kitchen", source: "hall", target: "kitchen" },
    ];

    type Model = FlowModel<Types, typeof features>;

    /**
     * The app's words for an engine event, or nothing for one it keeps quiet about. `startedFrom`:
     * the node a keyboard connection has just started from, said with its first target (both come
     * at once, and a live region reads only the last message) with the keys to use.
     */
    function describe(
        event: FlowEngineEvent,
        model: Model,
        startedFrom?: string,
    ): string | undefined {
        const name = (id: string) => model.get("node-by", { id })?.data.label ?? id;
        const names = (ids: readonly string[]) => ids.map(name).join(", ");
        switch (event.type) {
            case "nodes-move":
                return `Moved ${names(event.nodeIds)}${event.source === "keyboard" ? " with the keyboard" : ""}.`;
            case "drag-cancel":
                return `Put ${names(event.nodeIds)} back.`;
            case "connect-target": {
                const target =
                    event.nodeId === undefined
                        ? "No handle accepts this connection."
                        : `Target ${event.index + 1} of ${event.count}: ${name(event.nodeId)}.`;
                if (startedFrom === undefined) return target;
                const keys =
                    event.nodeId === undefined
                        ? "Escape to cancel."
                        : "Tab for the next, Enter to connect, Escape to cancel.";
                return `Connecting from ${name(startedFrom)}. ${target} ${keys}`;
            }
            case "connect":
                return `Connected ${name(event.source)} to ${name(event.target)}${event.input === "keyboard" ? " with the keyboard" : ""}.`;
            case "connect-cancel":
                if (event.refused) return "That connection is not allowed.";
                return event.input === "keyboard" ? "Connection cancelled." : undefined;
            case "remove": {
                const parts = [
                    event.nodeIds.length > 0
                        ? `${event.nodeIds.length} node(s)`
                        : "",
                    event.edgeIds.length > 0
                        ? `${event.edgeIds.length} edge(s)`
                        : "",
                ].filter(Boolean);
                return `Removed ${parts.join(" and ")}.`;
            }
            default:
                return undefined;
        }
    }
</script>

<script lang="ts">
    import { typedFlow, useFlowRef } from "@fragiola/flow-svelte";
    import { styles } from "./styles";

    const Flow = typedFlow<Types, typeof features>();
    const flow = useFlowRef<Types, typeof features>();
    let log = $state.raw<string[]>([]);

    // the engine is there once the root is mounted: listen to it while it is
    $effect(() => {
        const value = flow.current;
        if (!value) return;
        const { model, engine } = value;
        // a keyboard connection that has just started, until its first target
        let startedFrom: string | undefined;
        return engine.subscribe((event) => {
            if (event.type === "connect-start") {
                startedFrom = event.input === "keyboard" ? event.nodeId : undefined;
            }
            const message = describe(event, model, startedFrom);
            if (event.type === "connect-target") startedFrom = undefined;
            if (message) log = [message, ...log].slice(0, 6);
        });
    });
</script>

<Flow.Root
    flowRef={flow}
    {features}
    defaultNodes={nodes}
    defaultEdges={edges}
    fitView={{ padding: 0.2, maxZoom: 1 }}
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
                    aria-label={`${edge.source} to ${edge.target}`}
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
                    class={styles.node}
                >
                    {node.data.label}
                    <Flow.Handle
                        type="target"
                        side="top"
                        aria-label="{node.data.label} input"
                        class={styles.handle}
                    />
                    <Flow.Handle
                        type="source"
                        side="bottom"
                        aria-label="{node.data.label} output"
                        class={styles.handle}
                    />
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
        <Flow.ConnectionLine class={styles.connection} />
    </Flow.Viewport>
    <aside aria-label="What happened" class={styles.panel}>
        <!-- read aloud: only the latest message -->
        <p role="status" data-testid="announcement" class={styles.latest}>
            {log[0] ?? "Move, connect or delete a node."}
        </p>
        <ol aria-label="Earlier" class={styles.log}>
            <!-- the log is a stack: its index is its key -->
            {#each log.slice(1) as message, index (index)}
                <li>{message}</li>
            {/each}
        </ol>
    </aside>
</Flow.Root>
