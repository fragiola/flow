import {
    Flow,
    type FlowEdge,
    type FlowEdgeInput,
    type FlowNodeInput,
    type FlowTypes,
    useFlow,
} from "@fragiola/flow-react";
import { connection } from "@fragiola/flow-react/connection";
import { drag } from "@fragiola/flow-react/drag";
import { selection } from "@fragiola/flow-react/selection";
import { XIcon } from "lucide-react";
import { Badge } from "#/components/atoms/badge";
import { styles } from "./styles";

// `Flow.EdgeLabel` is HTML placed at the edge's label point (halfway along its path), in flow
// coordinates: it pans and zooms with the edge. It may hold anything: text from the edge's data, a
// badge, a button. A button in a label keeps its own clicks (it never starts a gesture).

interface Types extends FlowTypes {
    readonly nodes: { stage: { label: string } };
    readonly edges: {
        text: { text: string };
        status: { status: "passing" | "failing" };
        removable: Record<string, never>;
    };
}

const features = [selection(), drag(), connection()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "build",
        type: "stage",
        position: { x: 0, y: 0 },
        data: { label: "Build" },
    },
    {
        id: "test",
        type: "stage",
        position: { x: 280, y: 0 },
        data: { label: "Test" },
    },
    {
        id: "lint",
        type: "stage",
        position: { x: 280, y: 180 },
        data: { label: "Lint" },
    },
    {
        id: "deploy",
        type: "stage",
        position: { x: 560, y: 90 },
        data: { label: "Deploy" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    {
        id: "build-test",
        source: "build",
        target: "test",
        type: "text",
        data: { text: "on push" },
    },
    {
        id: "build-lint",
        source: "build",
        target: "lint",
        type: "status",
        data: { status: "failing" },
    },
    {
        id: "test-deploy",
        source: "test",
        target: "deploy",
        type: "status",
        data: { status: "passing" },
    },
    {
        id: "lint-deploy",
        source: "lint",
        target: "deploy",
        type: "removable",
        data: {},
    },
];

function RemoveButton({ edge }: { edge: FlowEdge<Types> }) {
    const { model } = useFlow<Types, typeof features>();
    return (
        <button
            type="button"
            aria-label={`Remove the edge from ${edge.source} to ${edge.target}`}
            onClick={() => model.run("edge.remove", { edgeId: edge.id })}
            className={styles.remove}
        >
            <XIcon />
        </button>
    );
}

function renderEdge(edge: FlowEdge<Types>) {
    return (
        <Flow.Edge<Types> edge={edge}>
            <Flow.EdgePath className={styles.edge} />
            <Flow.EdgeLabel className={styles.label}>
                {edge.type === "text" && (
                    <span className={styles.text}>{edge.data?.text}</span>
                )}
                {edge.type === "status" && (
                    <Badge
                        variant="soft"
                        className={styles.status(edge.data?.status)}
                    >
                        {edge.data?.status}
                    </Badge>
                )}
                {edge.type === "removable" && <RemoveButton edge={edge} />}
            </Flow.EdgeLabel>
        </Flow.Edge>
    );
}

export default function EdgeLabels() {
    return (
        <Flow.Root<Types, typeof features>
            features={features}
            defaultNodes={nodes}
            defaultEdges={edges}
            fitView={{ padding: 0.2, maxZoom: 1 }}
            pathOptions={{ borderRadius: 8 }}
            className={styles.root}
        >
            <Flow.Background variant="dots" size={2} className={styles.dots} />
            <Flow.Background variant="lines" className={styles.lines} />
            <Flow.Background variant="cross" className={styles.cross} />
            <Flow.Viewport>
                <Flow.Edges<Types>>{renderEdge}</Flow.Edges>
                <Flow.Nodes<Types>>
                    {(node) => (
                        <Flow.Node<Types> node={node} className={styles.node}>
                            {node.data.label}
                            <Flow.Handle
                                type="target"
                                side="left"
                                className={styles.handle}
                            />
                            <Flow.Handle
                                type="source"
                                side="right"
                                className={styles.handle}
                            />
                        </Flow.Node>
                    )}
                </Flow.Nodes>
                <Flow.ConnectionLine className={styles.connection} />
            </Flow.Viewport>
        </Flow.Root>
    );
}
