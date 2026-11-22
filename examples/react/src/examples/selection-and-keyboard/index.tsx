import {
    Flow,
    type FlowEdge,
    type FlowEdgeInput,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
    useSelection,
} from "@fragiola/flow-react";
import { connection } from "@fragiola/flow-react/connection";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import { selection } from "@fragiola/flow-react/selection";
import { styles } from "./styles";

// `selection()` selects with a click, adds with Shift (or Ctrl/Cmd) and draws a box with Shift and
// a drag on the canvas; `keyboard()` makes nodes and edges focusable: Tab moves through them,
// Enter or Space selects, the arrows move the selection (Shift for a bigger step), Delete removes
// it and Escape clears it. With `connection()` too, Tab also reaches the handles: Enter on one
// starts a connection, Tab (or the arrows) points at the next handle that accepts it, Enter draws
// the edge and Escape cancels. A box around two or more nodes leaves a rectangle around them
// (`Flow.NodesSelection`): dragging it moves the whole selection. The package names nothing: each
// node, handle and edge gets its name here.

interface Types extends FlowTypes {
    readonly nodes: { task: { label: string } };
}

const features = [selection(), drag(), connection(), keyboard()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "design",
        type: "task",
        position: { x: 0, y: 0 },
        data: { label: "Design" },
    },
    {
        id: "build",
        type: "task",
        position: { x: 220, y: 0 },
        data: { label: "Build" },
    },
    {
        id: "review",
        type: "task",
        position: { x: 440, y: 0 },
        data: { label: "Review" },
    },
    {
        id: "docs",
        type: "task",
        position: { x: 220, y: 150 },
        data: { label: "Docs" },
    },
    {
        id: "ship",
        type: "task",
        position: { x: 440, y: 150 },
        data: { label: "Ship" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "design-build", source: "design", target: "build" },
    { id: "build-review", source: "build", target: "review" },
    { id: "build-docs", source: "build", target: "docs" },
    { id: "review-ship", source: "review", target: "ship" },
    { id: "docs-ship", source: "docs", target: "ship" },
];

function renderNode(node: FlowNode<Types>) {
    return (
        <Flow.Node<Types>
            node={node}
            role="group"
            aria-roledescription="node"
            aria-label={node.data.label}
            className={styles.node}
        >
            {node.data.label}
            <Flow.Handle
                type="target"
                side="left"
                aria-label={`${node.data.label} input`}
                className={styles.handle}
            />
            <Flow.Handle
                type="source"
                side="right"
                aria-label={`${node.data.label} output`}
                className={styles.handle}
            />
        </Flow.Node>
    );
}

function renderEdge(edge: FlowEdge<Types>) {
    return (
        <Flow.Edge<Types>
            edge={edge}
            role="group"
            aria-roledescription="edge"
            aria-label={`${edge.source} to ${edge.target}`}
            className={styles.edgeGroup}
        >
            {/* a wide transparent path: a bigger target for a click */}
            <Flow.EdgePath className={styles.edgeHit} />
            <Flow.EdgePath className={styles.edge} />
        </Flow.Edge>
    );
}

/** What is selected, read with `useSelection()` inside the root. */
function SelectionStatus() {
    const selected = useSelection<Types>();
    const names = selected.nodes.map((node) => node.data.label);
    return (
        <div role="status" data-testid="selection" className={styles.status}>
            {selected.nodes.length === 0 && selected.edges.length === 0
                ? "Nothing selected"
                : `${selected.nodes.length} nodes, ${selected.edges.length} edges selected${names.length > 0 ? `: ${names.join(", ")}` : ""}`}
        </div>
    );
}

export default function SelectionAndKeyboard() {
    return (
        <Flow.Root<Types, typeof features>
            features={features}
            defaultNodes={nodes}
            defaultEdges={edges}
            fitView={{ padding: 0.2, maxZoom: 1 }}
            role="group"
            aria-label="Release plan"
            className={styles.root}
        >
            <Flow.Background variant="dots" size={2} className={styles.dots} />
            <Flow.Background variant="lines" className={styles.lines} />
            <Flow.Background variant="cross" className={styles.cross} />
            <Flow.Viewport>
                <Flow.Edges<Types>>{renderEdge}</Flow.Edges>
                <Flow.Nodes<Types>>{renderNode}</Flow.Nodes>
                <Flow.ConnectionLine className={styles.connection} />
                <Flow.NodesSelection className={styles.nodesSelection} />
            </Flow.Viewport>
            <Flow.SelectionBox className={styles.box} />
            <SelectionStatus />
            <p className={styles.hint}>
                Shift + drag draws a box, drag its rectangle to move it · Tab,
                arrows, Delete, Escape · Enter on a handle connects
            </p>
        </Flow.Root>
    );
}
