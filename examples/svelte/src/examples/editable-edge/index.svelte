<script module lang="ts">
    import type { FlowEdge, FlowEdgeInput, FlowNodeInput, FlowTypes } from "@fragiola/flow-svelte";
    import { drag } from "@fragiola/flow-svelte/drag";
    import { keyboard } from "@fragiola/flow-svelte/keyboard";
    import { selection } from "@fragiola/flow-svelte/selection";
    import type { Point } from "./control-points";

    // An edge the user shapes. Its control points live in the edge's `data` (`points`, in flow
    // coordinates) and change through the model (`edge.set-data`): the edge is drawn from its
    // source end through them to its target end (`control-points.ts`), so they override any route.
    // Drag a point to bend the edge (`screen-to-flow` turns the pointer into flow coordinates),
    // double-click the edge to add one where you clicked (`onedgedoubleclick`), and press Delete on
    // a focused point to remove it; the arrows move it. A point is a control of its own
    // (`data-flow-no-gesture`): pressing it neither pans the pane nor drags a node. "Route" asks
    // the grid search of `routing.ts` for an orthogonal way around every node's box
    // (`node-rect-by`) and stores its corners as the points; "Clear points" straightens the edges.

    export interface Types extends FlowTypes {
        readonly nodes: { box: { label: string; obstacle: boolean } };
        readonly edges: { editable: { points: Point[] } };
    }

    export const features = [selection(), drag(), keyboard()] as const;

    const box = (
        id: string,
        label: string,
        x: number,
        y: number,
        width = 120,
        height = 44,
    ): FlowNodeInput<Types> => ({
        id,
        type: "box",
        position: { x, y },
        width,
        height,
        data: { label, obstacle: false },
    });

    const nodes: FlowNodeInput<Types>[] = [
        box("source", "Source", 0, 120),
        // in the way, and joined to nothing: no handle
        {
            ...box("firewall", "Firewall", 240, 40, 140, 200),
            data: { label: "Firewall", obstacle: true },
        },
        box("target", "Target", 520, 120),
        box("archive", "Archive", 520, 320),
    ];

    const edges: FlowEdgeInput<Types>[] = [
        // straight through the firewall: "Route" takes it around
        {
            id: "source-target",
            source: "source",
            target: "target",
            type: "editable",
            data: { points: [] },
        },
        // already bent below it
        {
            id: "source-archive",
            source: "source",
            target: "archive",
            type: "editable",
            data: { points: [{ x: 180, y: 342 }] },
        },
    ];

    const LABELS: Record<string, string> = Object.fromEntries(
        nodes.map((node) => [node.id, node.data.label]),
    );

    export const nameOf = (edge: { source: string; target: string }) =>
        `${LABELS[edge.source]} to ${LABELS[edge.target]}`;

    /** The control points of an edge (none on an edge of another type). */
    export const pointsOf = (edge: FlowEdge<Types> | undefined): Point[] =>
        edge?.type === "editable" ? (edge.data?.points ?? []) : [];
</script>

<script lang="ts">
    import { type FlowEngineEventOf, typedFlow, useFlowRef } from "@fragiola/flow-svelte";
    import Actions from "./actions.svelte";
    import BendableEdge from "./bendable-edge.svelte";
    import { insertPoint } from "./control-points";
    import { styles } from "./styles";

    const Flow = typedFlow<Types, typeof features>();
    const flow = useFlowRef<Types, typeof features>();

    /** A double click on an edge: a point there, in the run nearest to it. */
    function onEdgeDoubleClick(event: FlowEngineEventOf<"edge-double-click">) {
        const current = flow.current;
        const edge = current?.model.get("edge-by", { id: event.edgeId });
        const path = current?.engine.get("edge-path-by", { edgeId: event.edgeId });
        if (!current || !edge || !path) return;
        current.model.run("edge.set-data", {
            edgeId: edge.id,
            data: {
                points: insertPoint(path.source, path.target, pointsOf(edge), event.point),
            },
        });
    }
</script>

<Flow.Root
    {features}
    defaultNodes={nodes}
    defaultEdges={edges}
    fitView={{ padding: 0.2, maxZoom: 1 }}
    flowRef={flow}
    onedgedoubleclick={onEdgeDoubleClick}
    role="group"
    aria-label="Editable edge"
    class={styles.root}
>
    <Flow.Background variant="dots" size={2} class={styles.dots} />
    <Flow.Background variant="lines" class={styles.lines} />
    <Flow.Background variant="cross" class={styles.cross} />
    <Flow.Viewport>
        <Flow.Edges>
            {#snippet children(edge)}
                {#if edge.type === "editable"}
                    <BendableEdge {edge} />
                {/if}
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
                    {#if !node.data.obstacle}
                        <Flow.Handle type="target" side="left" class={styles.handle} />
                        <Flow.Handle type="source" side="right" class={styles.handle} />
                    {/if}
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
    </Flow.Viewport>
    <Actions />
</Flow.Root>
