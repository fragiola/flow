import {
    Flow,
    type FlowEdge,
    type FlowEdgeInput,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
    useFlow,
    useNodeConnections,
    useNodeId,
    useNodesData,
} from "@fragiola/flow-react";
import { connection } from "@fragiola/flow-react/connection";
import { drag } from "@fragiola/flow-react/drag";
import { selection } from "@fragiola/flow-react/selection";
import { Minus, Plus } from "lucide-react";
import { styles } from "./styles";

// A node that computes from its inputs: the sum node reads the connections that end at it
// (`useNodeConnections`) and their source nodes' data (`useNodesData`), so it follows a value
// changed with the steppers and an edge connected or removed, and re-renders only then (a drag of
// another node does not touch it). Connect the third number to the sum to add it.

interface Types extends FlowTypes {
    readonly nodes: {
        number: { label: string; value: number };
        sum: { label: string };
    };
}

const features = [selection(), drag(), connection()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "a",
        type: "number",
        position: { x: 0, y: 0 },
        data: { label: "A", value: 3 },
    },
    {
        id: "b",
        type: "number",
        position: { x: 0, y: 130 },
        data: { label: "B", value: 5 },
    },
    {
        id: "c",
        type: "number",
        position: { x: 0, y: 260 },
        data: { label: "C", value: 8 },
    },
    {
        id: "sum",
        type: "sum",
        position: { x: 300, y: 110 },
        data: { label: "Sum" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "a-sum", source: "a", target: "sum" },
    { id: "b-sum", source: "b", target: "sum" },
];

/** A number's value, with its steppers: `node.set-data` from the model. */
function NumberBody({
    node,
}: {
    node: Extract<FlowNode<Types>, { type: "number" }>;
}) {
    const { model } = useFlow<Types, typeof features>();
    const step = (by: number) =>
        model.run("node.set-data", {
            nodeId: node.id,
            data: { value: node.data.value + by },
        });
    return (
        <div className={styles.row}>
            <span className={styles.title}>{node.data.label}</span>
            <button
                type="button"
                aria-label={`Decrease ${node.data.label}`}
                onClick={() => step(-1)}
                className={styles.step}
            >
                <Minus />
            </button>
            <output data-testid={`value-${node.id}`} className={styles.value}>
                {node.data.value}
            </output>
            <button
                type="button"
                aria-label={`Increase ${node.data.label}`}
                onClick={() => step(1)}
                className={styles.step}
            >
                <Plus />
            </button>
        </div>
    );
}

/** The sum of the nodes connected into this one: its connections, then their data. */
function SumBody() {
    const nodeId = useNodeId();
    const connections = useNodeConnections({ type: "target" });
    const inputs = useNodesData<Types>(
        connections.map((connection) => connection.source),
    );
    let total = 0;
    const labels: string[] = [];
    for (const input of inputs) {
        if (input.type !== "number") continue;
        total += input.data.value;
        labels.push(input.data.label);
    }
    return (
        <div className={styles.sum}>
            <span className={styles.title}>Sum</span>
            <output data-testid="sum-total" className={styles.total}>
                {total}
            </output>
            <span data-testid="sum-sources" className={styles.sources}>
                {labels.length > 0
                    ? `of ${labels.join(" + ")}`
                    : `nothing into ${nodeId}`}
            </span>
        </div>
    );
}

function renderNode(node: FlowNode<Types>) {
    return (
        <Flow.Node<Types>
            node={node}
            role="group"
            aria-roledescription="node"
            aria-label={node.data.label}
            className={styles.node}
        >
            {node.type === "number" ? (
                <>
                    <NumberBody node={node} />
                    <Flow.Handle
                        type="source"
                        side="right"
                        aria-label={`${node.data.label} output`}
                        className={styles.handle}
                    />
                </>
            ) : (
                <>
                    <SumBody />
                    <Flow.Handle
                        type="target"
                        side="left"
                        aria-label="Sum input"
                        className={styles.handle}
                    />
                </>
            )}
        </Flow.Node>
    );
}

function renderEdge(edge: FlowEdge<Types>) {
    return (
        <Flow.Edge<Types> edge={edge}>
            <Flow.EdgePath className={styles.edge} />
        </Flow.Edge>
    );
}

export default function ConnectedData() {
    return (
        <Flow.Root<Types, typeof features>
            features={features}
            defaultNodes={nodes}
            defaultEdges={edges}
            fitView={{ padding: 0.2, maxZoom: 1 }}
            role="group"
            aria-label="A sum of numbers"
            className={styles.root}
        >
            <Flow.Background variant="dots" size={2} className={styles.dots} />
            <Flow.Background variant="lines" className={styles.lines} />
            <Flow.Background variant="cross" className={styles.cross} />
            <Flow.Viewport>
                <Flow.Edges<Types>>{renderEdge}</Flow.Edges>
                <Flow.Nodes<Types>>{renderNode}</Flow.Nodes>
                <Flow.ConnectionLine className={styles.connection} />
            </Flow.Viewport>
            <p className={styles.hint}>
                Change a number, or connect C to the sum
            </p>
        </Flow.Root>
    );
}
