<script module lang="ts">
    import type { FlowJson, FlowModel, FlowTypes } from "@fragiola/flow-svelte";
    import { drag } from "@fragiola/flow-svelte/drag";
    import { type BeforeDelete, keyboard } from "@fragiola/flow-svelte/keyboard";
    import { selection } from "@fragiola/flow-svelte/selection";
    import { reconnectionPlan } from "./reconnect";

    // Deleting a node in the middle keeps the flow connected: each node that led into it is joined to
    // each node it led to. The model tells the neighbours (`incomers-by`, `outgoers-by`) and the edges
    // around them (`connected-edges-by`); `reconnect.ts` plans the new edges (no duplicate, no self
    // loop), and one `batch` removes the node and adds them: one step, one undo.
    //
    // The delete key goes through `keyboard({ beforeDelete })`, which is asked before anything goes:
    // it runs that batch itself and answers `false`, so the key removes nothing more. A middleware
    // cannot do it: a command it issues runs after the removal, as a step of its own. Each node's
    // delete button (delete-button.svelte) calls the same function.

    export interface Types extends FlowTypes {
        readonly nodes: { step: { label: string } };
    }

    const makeFeatures = (beforeDelete: BeforeDelete) =>
        [selection(), drag(), keyboard({ beforeDelete })] as const;

    export type Features = ReturnType<typeof makeFeatures>;

    const step = (id: string, label: string, x: number, y: number) => ({
        id,
        type: "step" as const,
        position: { x, y },
        width: 150,
        height: 56,
        data: { label },
    });

    const link = (source: string, target: string) => ({
        id: `${source}-${target}`,
        source,
        target,
    });

    const json: FlowJson<Types> = {
        version: 1,
        nodes: [
            // a chain
            step("fetch", "Fetch", 0, 0),
            step("parse", "Parse", 280, 0),
            step("store", "Store", 560, 0),
            // a node with two incomers and two outgoers (Upload reaches Archive already)
            step("upload", "Upload", 0, 160),
            step("email", "Email", 0, 300),
            step("merge", "Merge", 280, 230),
            step("archive", "Archive", 560, 160),
            step("index", "Index", 560, 300),
        ],
        edges: [
            link("fetch", "parse"),
            link("parse", "store"),
            link("upload", "merge"),
            link("email", "merge"),
            link("merge", "archive"),
            link("merge", "index"),
            link("upload", "archive"),
        ],
    };

    /** The node's labels, for the edges' names and the status. */
    const LABELS: Record<string, string> = Object.fromEntries(
        json.nodes.map((node) => [node.id, node.data.label]),
    );

    const labelOf = (id: string) => LABELS[id] ?? id;

    /**
     * Removes the nodes (and the edges asked for) and joins their incomers to their outgoers, in one
     * `batch`; says whether it could.
     */
    export function removeReconnecting(
        model: FlowModel<Types, Features>,
        nodeIds: readonly string[],
        edgeIds: readonly string[] = [],
    ): boolean {
        // the neighbours, then every edge around the deleted nodes and them
        const around = new Set(nodeIds);
        for (const nodeId of nodeIds) {
            for (const node of model.get("incomers-by", { nodeId }))
                around.add(node.id);
            for (const node of model.get("outgoers-by", { nodeId }))
                around.add(node.id);
        }
        const edges = model.get("connected-edges-by", { nodeIds: [...around] });
        // a node's own edges go with it (and still join its neighbours): the other edges asked for
        // are removed one by one, and join nothing
        const gone = new Set(nodeIds);
        const loose = edgeIds.filter((edgeId) => {
            const edge = model.get("edge-by", { id: edgeId });
            return edge && !gone.has(edge.source) && !gone.has(edge.target);
        });
        const planned = reconnectionPlan(edges, nodeIds, {
            removedEdgeIds: loose,
            isTaken: (id) => model.get("edge-by", { id }) !== undefined,
        });
        // the nodes removed, or, with only edges asked for, those edges
        const removed =
            nodeIds.length > 0
                ? nodeIds.map(labelOf).join(", ")
                : loose
                      .map((edgeId) => model.get("edge-by", { id: edgeId }))
                      .filter((edge) => edge !== undefined)
                      .map(
                          (edge) =>
                              `${labelOf(edge.source)} to ${labelOf(edge.target)}`,
                      )
                      .join(", ");
        const joinedNames = planned.map(
            (edge) => `${labelOf(edge.source)} to ${labelOf(edge.target)}`,
        );
        // what the status says, carried by the batch's meta to whoever listens
        const said =
            joinedNames.length === 0
                ? `Removed ${removed}.`
                : `Removed ${removed}; joined ${joinedNames.join(", ")}.`;
        return model.run(
            "batch",
            {
                commands: [
                    ...nodeIds.map((nodeId) => ({
                        command: "node.remove" as const,
                        payload: { nodeId },
                    })),
                    ...loose.map((edgeId) => ({
                        command: "edge.remove" as const,
                        payload: { edgeId },
                    })),
                    ...planned.map((edge) => ({
                        command: "edge.add" as const,
                        payload: edge,
                    })),
                ],
            },
            { meta: { said } },
        ).ok;
    }
</script>

<script lang="ts">
    import { typedFlow, useFlowRef } from "@fragiola/flow-svelte";
    import DeleteButton from "./delete-button.svelte";
    import Status from "./status.svelte";
    import { styles } from "./styles";

    const Flow = typedFlow<Types, Features>();
    const flow = useFlowRef<Types, Features>();
    // the features are made once, their `beforeDelete` reaching the model through the flow's ref
    const features = makeFeatures((nodes, edges) => {
        const model = flow.current?.model;
        if (model) {
            removeReconnecting(
                model,
                nodes.map((node) => node.id),
                edges.map((edge) => edge.id),
            );
        }
        // removed already, in the batch: the key removes nothing more
        return false;
    });
</script>

<Flow.Root
    {features}
    defaultNodes={json.nodes}
    defaultEdges={json.edges}
    fitView={{ padding: 0.2, maxZoom: 1 }}
    flowRef={flow}
    role="group"
    aria-label="Delete middle node"
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
                    class={styles.node}
                >
                    <Flow.Handle type="target" side="left" class={styles.handle} />
                    <span class={styles.label}>{node.data.label}</span>
                    <DeleteButton {node} />
                    <Flow.Handle type="source" side="right" class={styles.handle} />
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
    </Flow.Viewport>
    <Status />
</Flow.Root>
