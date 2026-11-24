<script module lang="ts">
    import type { FlowEdgeInput, FlowNode, FlowNodeInput, FlowTypes } from "@fragiola/flow-svelte";
    import { connection } from "@fragiola/flow-svelte/connection";
    import { drag } from "@fragiola/flow-svelte/drag";
    import { keyboard } from "@fragiola/flow-svelte/keyboard";
    import { resize } from "@fragiola/flow-svelte/resize";
    import { selection } from "@fragiola/flow-svelte/selection";
    import { SHAPE_NAMES, type Shape } from "./shape-path";

    // A flowchart: each node draws its shape as an SVG path sized to the node (`shape-path.ts`),
    // and the selected node's toolbar picks another shape (`node.set-data`, shape-picker.svelte).
    // The node is resized from its corners and sides (`NodeResizer`), and turned from the knob
    // above it (rotate-handle.svelte): the angle is the node's data, applied by the node's own
    // `rotate()` on its content. Its handles turn with it, and each one takes the side it now faces
    // (`rotation.ts`), so its edges leave the way it points; the handles are remounted on a turn
    // (`{#key}`), since a transform changes no size the engine would notice. The knob is a slider:
    // drag it (Shift snaps to 15°) or use the arrows. Double-click a node (`onnodedoubleclick`), or
    // press its toolbar's pencil, to edit its label in place (shape-label.svelte): Enter keeps it,
    // Escape drops it.

    export interface Types extends FlowTypes {
        readonly nodes: { shape: { label: string; shape: Shape; angle: number } };
    }

    export type Node = FlowNode<Types>;

    export const features = [
        selection(),
        drag(),
        connection(),
        resize({ minWidth: 60, minHeight: 40 }),
        keyboard(),
    ] as const;

    /** A node of the chart: its id, place, size, shape and label. */
    function chartNode(
        id: string,
        shape: Shape,
        label: string,
        x: number,
        y: number,
        width = 140,
        height = 64,
    ): FlowNodeInput<Types> {
        return {
            id,
            type: "shape",
            position: { x, y },
            width,
            height,
            data: { label, shape, angle: 0 },
        };
    }

    const nodes: FlowNodeInput<Types>[] = [
        chartNode("start", "circle", "Start", 130, 0, 140, 56),
        chartNode("read", "parallelogram", "Read order", 130, 110, 140, 56),
        {
            ...chartNode("check", "diamond", "In stock?", 130, 240, 140, 88),
            selected: true,
        },
        chartNode("reject", "rounded", "Notify buyer", 0, 400, 140, 56),
        chartNode("pick", "rectangle", "Pick items", 260, 400, 140, 56),
        chartNode("log", "cylinder", "Log reason", 0, 510, 140, 72),
        chartNode("ship", "hexagon", "Ship", 260, 510, 140, 56),
    ];

    const edges: FlowEdgeInput<Types>[] = [
        { id: "start-read", source: "start", target: "read" },
        { id: "read-check", source: "read", target: "check" },
        { id: "check-reject", source: "check", target: "reject" },
        { id: "check-pick", source: "check", target: "pick" },
        { id: "reject-log", source: "reject", target: "log" },
        { id: "pick-ship", source: "pick", target: "ship" },
    ];
</script>

<script lang="ts">
    import { typedFlow } from "@fragiola/flow-svelte";
    import ShapeNode from "./shape-node.svelte";
    import { styles } from "./styles";

    const Flow = typedFlow<Types, typeof features>();
    /** Which node's label is edited in place (one at a time). */
    let editing = $state<string | undefined>();
</script>

<Flow.Root
    {features}
    defaultNodes={nodes}
    defaultEdges={edges}
    fitView={{ padding: 0.2, maxZoom: 1 }}
    role="group"
    aria-label="Order flowchart"
    onnodedoubleclick={(event) => (editing = event.nodeId)}
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
                    <!-- a wide transparent path: a bigger target for a click -->
                    <Flow.EdgePath class={styles.edgeHit} />
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
                    aria-label={`${node.data.label} (${SHAPE_NAMES[node.data.shape]})`}
                    class={styles.node}
                >
                    <ShapeNode
                        {node}
                        editing={editing === node.id}
                        onediting={(on) => (editing = on ? node.id : undefined)}
                    />
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
        <Flow.ConnectionLine class={styles.connection} />
    </Flow.Viewport>
    <p class={styles.hint}>
        Drag the knob to rotate (Shift snaps) · double-click a node to edit its label
    </p>
</Flow.Root>
