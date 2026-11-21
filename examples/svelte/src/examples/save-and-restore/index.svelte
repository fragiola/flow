<script module lang="ts">
    import type {
        FlowDocumentJson,
        FlowEdgeInput,
        FlowNodeInput,
        FlowTypes,
        Viewport,
    } from "@fragiola/flow-svelte";
    import { connection } from "@fragiola/flow-svelte/connection";
    import { drag } from "@fragiola/flow-svelte/drag";
    import { selection } from "@fragiola/flow-svelte/selection";

    // The document is plain JSON: `model.get("flow-json")` is everything to save (nodes, edges, the
    // selection), and the viewport is the engine's (`engine.get("viewport")`). Restoring brings the
    // live model to the saved document with the commands a user would have run
    // (`model.get("commands-to", …)`, one `batch`) and sets the viewport back. Nothing remounts.
    // The toolbar reaches the model and the engine through the root's flow ref.

    interface Types extends FlowTypes {
        readonly nodes: { topic: { label: string } };
    }

    const features = [selection(), drag(), connection()] as const;

    const KEY = "fragiola-flow-example:save-and-restore";

    interface Saved {
        flow: FlowDocumentJson<Types>;
        viewport: Viewport;
    }

    const nodes: FlowNodeInput<Types>[] = [
        {
            id: "plan",
            type: "topic",
            position: { x: 0, y: 0 },
            data: { label: "Plan" },
        },
        {
            id: "write",
            type: "topic",
            position: { x: 200, y: 100 },
            data: { label: "Write" },
        },
    ];

    const edges: FlowEdgeInput<Types>[] = [{ id: "plan-write", source: "plan", target: "write" }];

    /** A viewport read back from storage: three numbers. */
    function isViewport(value: unknown): value is Viewport {
        const { x, y, zoom } = (value ?? {}) as Partial<Record<string, unknown>>;
        return [x, y, zoom].every((n) => typeof n === "number" && Number.isFinite(n));
    }
</script>

<script lang="ts">
    import { typedFlow, useFlowRef, validateFlow } from "@fragiola/flow-svelte";
    import { PlusIcon, RotateCcwIcon, SaveIcon } from "@lucide/svelte";
    import { load, save } from "../_kit/persistence";
    import { styles } from "./styles";

    const Flow = typedFlow<Types, typeof features>();
    const flow = useFlowRef<Types, typeof features>();
    let message = $state(load<Saved>(KEY) ? "A saved flow is waiting." : "Nothing saved yet.");

    function onSave(): void {
        if (!flow.current) return;
        const { model, engine } = flow.current;
        const saved: Saved = {
            flow: model.get("flow-json"),
            viewport: engine.get("viewport"),
        };
        message = save(KEY, saved)
            ? `Saved ${saved.flow.nodes.length} nodes.`
            : "Storage is unavailable.";
    }

    function onRestore(): void {
        if (!flow.current) return;
        const { model, engine } = flow.current;
        const saved = load<Saved>(KEY);
        if (!saved) {
            message = "Nothing saved yet.";
            return;
        }
        // storage is outside the app: check what comes back before loading it
        if (!isViewport(saved.viewport) || validateFlow(saved.flow, { features }).length > 0) {
            message = "The saved flow is unreadable.";
            return;
        }
        const commands = model.get("commands-to", {
            nodes: saved.flow.nodes,
            edges: saved.flow.edges,
        });
        if (commands.length > 0) model.run("batch", { commands: [...commands] });
        engine.run("set-viewport", saved.viewport);
        message = `Restored ${saved.flow.nodes.length} nodes.`;
    }

    function onAdd(): void {
        if (!flow.current) return;
        const { model, engine } = flow.current;
        const count = model.get("all-nodes").length;
        const { x, y, zoom } = engine.get("viewport");
        const size = engine.get("root-size");
        model.run("node.add", {
            type: "topic",
            // somewhere in view, in flow coordinates
            position: {
                x: (size.width / 2 - x) / zoom - 60 + Math.round(Math.random() * 120 - 60),
                y: (size.height / 2 - y) / zoom - 20 + Math.round(Math.random() * 120 - 60),
            },
            data: { label: `Topic ${count + 1}` },
        });
    }
</script>

<Flow.Root
    flowRef={flow}
    {features}
    defaultNodes={nodes}
    defaultEdges={edges}
    defaultViewport={{ x: 120, y: 120, zoom: 1 }}
    class={styles.root}
>
    <Flow.Background variant="dots" size={2} class={styles.dots} />
    <Flow.Background variant="lines" class={styles.lines} />
    <Flow.Background variant="cross" class={styles.cross} />
    <Flow.Viewport>
        <Flow.Edges>
            {#snippet children(edge)}
                <Flow.Edge {edge}>
                    <Flow.EdgePath class={styles.edge} />
                </Flow.Edge>
            {/snippet}
        </Flow.Edges>
        <Flow.Nodes>
            {#snippet children(node)}
                <Flow.Node {node} class={styles.node}>
                    {node.data.label}
                    <Flow.Handle type="target" side="top" class={styles.handle} />
                    <Flow.Handle type="source" side="bottom" class={styles.handle} />
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
        <Flow.ConnectionLine class={styles.connection} />
    </Flow.Viewport>
    <div role="toolbar" aria-label="Flow file" class={styles.panel}>
        <button type="button" class={styles.button} onclick={onAdd}>
            <PlusIcon />
            Add a node
        </button>
        <button type="button" class={styles.primary} onclick={onSave}>
            <SaveIcon />
            Save
        </button>
        <button type="button" class={styles.button} onclick={onRestore}>
            <RotateCcwIcon />
            Restore
        </button>
        <p role="status" data-testid="message" class={styles.message}>
            {message}
        </p>
    </div>
</Flow.Root>
