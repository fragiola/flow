<script module lang="ts">
    import type { FlowEdgeInput, FlowNodeInput, FlowTypes } from "@fragiola/flow-svelte";
    import { connection } from "@fragiola/flow-svelte/connection";
    import { drag } from "@fragiola/flow-svelte/drag";
    import { keyboard } from "@fragiola/flow-svelte/keyboard";
    import { selection } from "@fragiola/flow-svelte/selection";

    // Undo is app policy: `_kit/undo.ts` (copy it) listens to the model and keeps the documents
    // before each step. A drag is one step (its transient moves end with a final one), and so is a
    // connection or a deletion (Delete removes the selection with its edges, in one command).
    // Selecting is not a step. Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z redoes.

    interface Types extends FlowTypes {
        readonly nodes: { block: { label: string } };
    }

    const features = [selection(), drag(), connection(), keyboard()] as const;

    const nodes: FlowNodeInput<Types>[] = [
        {
            id: "a",
            type: "block",
            position: { x: 0, y: 0 },
            data: { label: "Drag" },
        },
        {
            id: "b",
            type: "block",
            position: { x: 220, y: 0 },
            data: { label: "Connect" },
        },
        {
            id: "c",
            type: "block",
            position: { x: 110, y: 140 },
            data: { label: "Delete" },
        },
    ];

    const edges: FlowEdgeInput<Types>[] = [{ id: "a-c", source: "a", target: "c" }];
</script>

<script lang="ts">
    import { createFlowModel, typedFlow } from "@fragiola/flow-svelte";
    import { Redo2Icon, Undo2Icon } from "@lucide/svelte";
    import {
        createUndoHistory,
        handleUndoKeys,
        type UndoHistory,
        type UndoSnapshot,
    } from "../_kit/undo";
    import { styles } from "./styles";

    const Flow = typedFlow<Types, typeof features>();

    // the model is made here, so that the history and the shortcuts sit beside the root
    const model = createFlowModel<Types, typeof features>(
        { version: 1, nodes, edges },
        { features },
    );
    let history = $state.raw<UndoHistory | null>(null);
    let snapshot = $state.raw<UndoSnapshot | null>(null);

    // the shortcuts, on the window: a Delete leaves the focus on the page, not in the flow (an app
    // with other editable content would scope them to its editor)
    function onkeydown(event: KeyboardEvent): void {
        if (history) handleUndoKeys(history, event);
    }

    $effect(() => {
        const created = createUndoHistory(model);
        history = created;
        snapshot = created.getSnapshot();
        const unsubscribe = created.subscribe(() => {
            snapshot = created.getSnapshot();
        });
        return () => {
            unsubscribe();
            created.dispose();
        };
    });
</script>

<svelte:window {onkeydown} />

<Flow.Root {model} fitView={{ padding: 0.2, maxZoom: 1 }} class={styles.root}>
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
                    <Flow.Handle type="target" side="top" class={styles.handle} />
                    <Flow.Handle type="source" side="bottom" class={styles.handle} />
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
        <Flow.ConnectionLine class={styles.connection} />
    </Flow.Viewport>
    {#if history && snapshot}
        {@const current = history}
        <div class={styles.panel}>
            <div role="toolbar" aria-label="History" class={styles.buttons}>
                <button
                    type="button"
                    aria-label="Undo"
                    disabled={!snapshot.canUndo}
                    class={styles.button}
                    onclick={() => current.undo()}
                >
                    <Undo2Icon />
                </button>
                <button
                    type="button"
                    aria-label="Redo"
                    disabled={!snapshot.canRedo}
                    class={styles.button}
                    onclick={() => current.redo()}
                >
                    <Redo2Icon />
                </button>
            </div>
            <ol aria-label="Steps" data-testid="steps" class={styles.steps}>
                <!-- the steps are a stack: their index is their key -->
                {#each snapshot.undoSteps as step, index (index)}
                    <li class={styles.step}>{step}</li>
                {/each}
            </ol>
        </div>
    {/if}
</Flow.Root>
