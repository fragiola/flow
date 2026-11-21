import {
    Flow,
    type FlowEdgeInput,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-react";
import { LockIcon, MaximizeIcon, MinusIcon, PlusIcon } from "lucide-react";
import { Badge } from "#/components/atoms/badge";
import { styles } from "./styles";

// A flow with no features is a diagram: it draws, pans and zooms (the core's viewport), and
// nothing in it can be selected, dragged, connected or deleted. Add a feature to the list to opt
// into its gesture. The handles stay as anchors for the edges.

interface Types extends FlowTypes {
    readonly nodes: {
        service: { label: string; kind: "client" | "service" | "store" };
    };
}

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "web",
        type: "service",
        position: { x: 0, y: 0 },
        data: { label: "Web app", kind: "client" },
    },
    {
        id: "mobile",
        type: "service",
        position: { x: 220, y: 0 },
        data: { label: "Mobile app", kind: "client" },
    },
    {
        id: "api",
        type: "service",
        position: { x: 110, y: 130 },
        data: { label: "API gateway", kind: "service" },
    },
    {
        id: "auth",
        type: "service",
        position: { x: -60, y: 260 },
        data: { label: "Auth", kind: "service" },
    },
    {
        id: "orders",
        type: "service",
        position: { x: 280, y: 260 },
        data: { label: "Orders", kind: "service" },
    },
    {
        id: "db",
        type: "service",
        position: { x: 110, y: 390 },
        data: { label: "Postgres", kind: "store" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "web-api", source: "web", target: "api", type: "smoothstep" },
    { id: "mobile-api", source: "mobile", target: "api", type: "smoothstep" },
    { id: "api-auth", source: "api", target: "auth", type: "smoothstep" },
    { id: "api-orders", source: "api", target: "orders", type: "smoothstep" },
    { id: "auth-db", source: "auth", target: "db", type: "smoothstep" },
    { id: "orders-db", source: "orders", target: "db", type: "smoothstep" },
];

const features = [] as const;

export default function ReadOnly() {
    return (
        <Flow.Root<Types, typeof features>
            features={features}
            defaultNodes={nodes}
            defaultEdges={edges}
            fitView={{ padding: 0.2, maxZoom: 1 }}
            className={styles.root}
        >
            <Flow.Background variant="dots" size={2} className={styles.dots} />
            <Flow.Background variant="lines" className={styles.lines} />
            <Flow.Background variant="cross" className={styles.cross} />
            <Flow.Viewport>
                <Flow.Edges<Types>>
                    {(edge) => (
                        <Flow.Edge<Types> edge={edge}>
                            <Flow.EdgePath className={styles.edge} />
                        </Flow.Edge>
                    )}
                </Flow.Edges>
                <Flow.Nodes<Types>>
                    {(node) => (
                        <Flow.Node<Types>
                            node={node}
                            className={styles.node(node.data.kind)}
                        >
                            {node.data.label}
                            <Flow.Handle
                                type="target"
                                side="top"
                                className={styles.anchor}
                            />
                            <Flow.Handle
                                type="source"
                                side="bottom"
                                className={styles.anchor}
                            />
                        </Flow.Node>
                    )}
                </Flow.Nodes>
            </Flow.Viewport>
            <Badge variant="outline" className={styles.badge}>
                <LockIcon />
                Read-only
            </Badge>
            <Flow.Controls
                role="group"
                aria-label="Zoom"
                className={styles.controls}
            >
                <Flow.ZoomIn aria-label="Zoom in" className={styles.control}>
                    <PlusIcon />
                </Flow.ZoomIn>
                <Flow.ZoomOut aria-label="Zoom out" className={styles.control}>
                    <MinusIcon />
                </Flow.ZoomOut>
                <Flow.FitView aria-label="Fit view" className={styles.control}>
                    <MaximizeIcon />
                </Flow.FitView>
            </Flow.Controls>
        </Flow.Root>
    );
}
