import {
    Flow,
    type FlowEdge,
    type FlowJson,
    type FlowNode,
    type FlowTypes,
    useFlowStore,
    useViewport,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import { selection } from "@fragiola/flow-react/selection";
import { MaximizeIcon, MinusIcon, PlusIcon } from "lucide-react";
import { Badge } from "#/components/atoms/badge";
import { atLeast, type Detail, detailOf, showsLabels } from "./detail";
import { styles } from "./styles";

// The nodes show more as the flow zooms in: at a glance only their name, closer their kind and
// health, closest their owner and figures. The edges' labels show from a zoom of 1. The zoom is
// view state: `useViewport()` gives it (the readout in the corner re-renders with every frame of a
// pan or zoom), and `useFlowStore` selects only what a part needs from it (`detailOf(zoom)`, a
// string), so a node re-renders when its level changes, not on every frame. The thresholds live in
// `detail.ts`; each node carries its level as `data-detail`.

interface Service {
    label: string;
    kind: string;
    owner: string;
    health: "healthy" | "degraded";
    requests: string;
    latency: string;
}

interface Types extends FlowTypes {
    readonly nodes: { service: Service };
    readonly edges: { call: { label: string } };
}

const features = [selection(), drag(), keyboard()] as const;

const service = (id: string, x: number, y: number, data: Service) => ({
    id,
    type: "service" as const,
    position: { x, y },
    data,
});

const call = (source: string, target: string, label: string) => ({
    id: `${source}-${target}`,
    source,
    target,
    type: "call" as const,
    data: { label },
});

const json: FlowJson<Types> = {
    version: 1,
    nodes: [
        service("gateway", 0, 120, {
            label: "Gateway",
            kind: "Edge proxy",
            owner: "Platform",
            health: "healthy",
            requests: "1.2k req/s",
            latency: "18 ms",
        }),
        service("orders", 300, 0, {
            label: "Orders",
            kind: "HTTP service",
            owner: "Commerce",
            health: "healthy",
            requests: "340 req/s",
            latency: "42 ms",
        }),
        service("search", 300, 240, {
            label: "Search",
            kind: "HTTP service",
            owner: "Discovery",
            health: "degraded",
            requests: "860 req/s",
            latency: "310 ms",
        }),
        service("billing", 600, 0, {
            label: "Billing",
            kind: "Worker",
            owner: "Payments",
            health: "healthy",
            requests: "75 jobs/s",
            latency: "90 ms",
        }),
        service("index", 600, 240, {
            label: "Index",
            kind: "Database",
            owner: "Discovery",
            health: "healthy",
            requests: "2.4k reads/s",
            latency: "4 ms",
        }),
    ],
    edges: [
        call("gateway", "orders", "POST /orders"),
        call("gateway", "search", "GET /search"),
        call("orders", "billing", "charge"),
        call("search", "index", "query"),
    ],
};

/** The nodes' labels, for the edges' names. */
const LABELS: Record<string, string> = Object.fromEntries(
    json.nodes.map((node) => [node.id, node.data.label]),
);

const labelOf = (id: string) => LABELS[id] ?? id;

/** The detail level at the current zoom; re-renders only when the level changes. */
function useDetail(): Detail {
    return useFlowStore<Detail, Types, typeof features>(({ engine }) =>
        detailOf(engine.get("viewport").zoom),
    );
}

/** A service: its name; from medium detail its kind and health; at high its owner and figures. */
function ServiceNode({ node }: { node: FlowNode<Types> }) {
    const detail = useDetail();
    const { label, kind, owner, health, requests, latency } = node.data;
    return (
        <Flow.Node<Types>
            node={node}
            role="group"
            aria-roledescription="service"
            aria-label={label}
            data-detail={detail}
            className={styles.node}
        >
            <Flow.Handle type="target" side="left" className={styles.handle} />
            <span className={styles.title}>{label}</span>
            {atLeast(detail, "medium") && (
                <span className={styles.summary}>
                    <span>{kind}</span>
                    <Badge variant="soft" className={styles.health(health)}>
                        {health}
                    </Badge>
                </span>
            )}
            {atLeast(detail, "high") && (
                <dl className={styles.facts}>
                    <dt className={styles.term}>Owner</dt>
                    <dd>{owner}</dd>
                    <dt className={styles.term}>Load</dt>
                    <dd>{requests}</dd>
                    <dt className={styles.term}>p95</dt>
                    <dd>{latency}</dd>
                </dl>
            )}
            <Flow.Handle type="source" side="right" className={styles.handle} />
        </Flow.Node>
    );
}

/** A call between two services; its label shows from a zoom of 1. */
function CallEdge({ edge }: { edge: FlowEdge<Types> }) {
    const labelled = useFlowStore<boolean, Types, typeof features>(
        ({ engine }) => showsLabels(engine.get("viewport").zoom),
    );
    const text = edge.type === "call" ? (edge.data?.label ?? "") : "";
    return (
        <Flow.Edge<Types>
            edge={edge}
            role="group"
            aria-roledescription="edge"
            aria-label={`${labelOf(edge.source)} to ${labelOf(edge.target)}: ${text}`}
            className={styles.edgeGroup}
        >
            <Flow.EdgePath className={styles.edge} />
            {labelled && (
                <Flow.EdgeLabel className={styles.label}>{text}</Flow.EdgeLabel>
            )}
        </Flow.Edge>
    );
}

/** The zoom as a percentage and the level it gives, from `useViewport()`. */
function ZoomReadout() {
    const { zoom } = useViewport();
    return (
        <p data-testid="zoom-readout" className={styles.readout}>
            {Math.round(zoom * 100)}% · {detailOf(zoom)} detail
        </p>
    );
}

function renderNode(node: FlowNode<Types>) {
    return <ServiceNode node={node} />;
}

function renderEdge(edge: FlowEdge<Types>) {
    return <CallEdge edge={edge} />;
}

export default function ContextualZoom() {
    return (
        <Flow.Root<Types, typeof features>
            features={features}
            defaultNodes={json.nodes}
            defaultEdges={json.edges}
            fitView={{ padding: 0.2, maxZoom: 1 }}
            minZoom={0.4}
            maxZoom={2}
            role="group"
            aria-label="Contextual zoom"
            className={styles.root}
        >
            <Flow.Background variant="dots" size={2} className={styles.dots} />
            <Flow.Background variant="lines" className={styles.lines} />
            <Flow.Background variant="cross" className={styles.cross} />
            <Flow.Viewport>
                <Flow.Edges<Types>>{renderEdge}</Flow.Edges>
                <Flow.Nodes<Types>>{renderNode}</Flow.Nodes>
            </Flow.Viewport>
            <Flow.Controls
                role="group"
                aria-label="Zoom"
                className={styles.controls}
            >
                <Flow.ZoomIn
                    duration={200}
                    aria-label="Zoom in"
                    className={styles.control}
                >
                    <PlusIcon />
                </Flow.ZoomIn>
                <Flow.ZoomOut
                    duration={200}
                    aria-label="Zoom out"
                    className={styles.control}
                >
                    <MinusIcon />
                </Flow.ZoomOut>
                <Flow.FitView
                    duration={200}
                    padding={0.2}
                    maxZoom={1}
                    aria-label="Fit view"
                    className={styles.control}
                >
                    <MaximizeIcon />
                </Flow.FitView>
            </Flow.Controls>
            <ZoomReadout />
        </Flow.Root>
    );
}
