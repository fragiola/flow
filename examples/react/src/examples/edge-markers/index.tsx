import {
    Flow,
    type FlowEdge,
    type FlowEdgeInput,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import { selection } from "@fragiola/flow-react/selection";
import { type CSSProperties, createContext, useContext, useId } from "react";
import {
    describeEnds,
    type Ends,
    GEOMETRY,
    idPrefix,
    markerId,
    markersFor,
    markerUrl,
} from "./markers";
import { styles } from "./styles";

// No marker is built in: markers are plain SVG. The example defines its own `<marker>`s (arrows,
// open arrows, circles and diamonds, `markers.ts`) in an svg of its own, and points each edge
// path's `markerStart` / `markerEnd` at them. A marker is coloured where it is defined, not by the
// path that uses it, so there is one per shape and tone, and one per shape for the selected state:
// selected, the path's `data-selected` swaps to those (`--marker-*-selected`, `styles.ts`). The ids
// start with `useId`, so two of these flows on one page never point at each other's markers.

interface Types extends FlowTypes {
    readonly nodes: { service: { label: string } };
    readonly edges: {
        marked: Ends;
    };
}

const features = [selection(), drag(), keyboard()] as const;

const service = (id: string, label: string, x: number, y: number) => ({
    id,
    type: "service" as const,
    position: { x, y },
    data: { label },
});

const nodes: FlowNodeInput<Types>[] = [
    service("client", "Client", 0, 120),
    service("gateway", "Gateway", 240, 120),
    service("auth", "Auth", 500, 0),
    service("orders", "Orders", 500, 240),
    service("database", "Database", 760, 160),
    service("cache", "Cache", 760, 330),
];

/** Each edge's ends and tone: what its markers are. */
const MARKED: readonly (readonly [string, string, Ends])[] = [
    ["client", "gateway", { end: "arrow", tone: "neutral" }],
    ["gateway", "auth", { start: "circle", end: "open-arrow", tone: "purple" }],
    ["gateway", "orders", { start: "diamond", end: "arrow", tone: "blue" }],
    ["orders", "database", { start: "arrow", end: "arrow", tone: "orange" }],
    ["orders", "cache", { end: "circle", tone: "green" }],
];

const edges: FlowEdgeInput<Types>[] = MARKED.map(([source, target, data]) => ({
    id: `${source}-${target}`,
    source,
    target,
    type: "marked",
    data,
}));

/** The markers these edges use, each defined once per flow. */
const MARKERS = markersFor(MARKED.map(([, , ends]) => ends));

/** An edge's ends: its data when it is a marked edge, none otherwise. */
const endsOf = (edge: FlowEdge<Types>): Ends =>
    edge.type === "marked" && edge.data ? edge.data : { tone: "neutral" };

const LABELS: Record<string, string> = Object.fromEntries(
    nodes.map((node) => [node.id, node.data.label]),
);

/** This flow's marker id prefix, for the edges (their render function is a module one). */
const Prefix = createContext("");

/** The `<marker>`s, in an svg of no size: every edge path of this flow points at them. */
function MarkerDefs({ prefix }: { prefix: string }) {
    return (
        <svg aria-hidden="true" className={styles.defs}>
            <defs>
                {MARKERS.map(({ shape, state }) => {
                    const { d, refX, filled } = GEOMETRY[shape];
                    return (
                        <marker
                            key={`${shape}-${state}`}
                            id={markerId(prefix, shape, state)}
                            viewBox="0 0 10 10"
                            refX={refX}
                            refY={5}
                            markerWidth={12}
                            markerHeight={12}
                            markerUnits="userSpaceOnUse"
                            orient="auto-start-reverse"
                            className={styles.marker(state)}
                        >
                            <path
                                d={d}
                                className={
                                    filled ? styles.filled : styles.outlined
                                }
                            />
                        </marker>
                    );
                })}
            </defs>
        </svg>
    );
}

function MarkedEdge({ edge }: { edge: FlowEdge<Types> }) {
    const prefix = useContext(Prefix);
    const ends = endsOf(edge);
    const selected = {
        "--marker-start-selected": markerUrl(prefix, ends.start, "selected"),
        "--marker-end-selected": markerUrl(prefix, ends.end, "selected"),
    } as CSSProperties;
    return (
        <Flow.Edge<Types>
            edge={edge}
            role="group"
            aria-roledescription="edge"
            aria-label={`${LABELS[edge.source]} to ${LABELS[edge.target]}: ${describeEnds(ends)}`}
            className={styles.edgeGroup}
        >
            {/* a wide transparent path: a bigger target for a click */}
            <Flow.EdgePath className={styles.edgeHit} />
            <Flow.EdgePath
                markerStart={markerUrl(prefix, ends.start, ends.tone)}
                markerEnd={markerUrl(prefix, ends.end, ends.tone)}
                style={selected}
                className={styles.edge(ends.tone)}
            />
        </Flow.Edge>
    );
}

function renderEdge(edge: FlowEdge<Types>) {
    return <MarkedEdge edge={edge} />;
}

function renderNode(node: FlowNode<Types>) {
    const { label } = node.data;
    return (
        <Flow.Node<Types>
            node={node}
            role="group"
            aria-roledescription="node"
            aria-label={label}
            className={styles.node}
        >
            <Flow.Handle type="target" side="left" className={styles.handle} />
            {label}
            <Flow.Handle type="source" side="right" className={styles.handle} />
        </Flow.Node>
    );
}

export default function EdgeMarkers() {
    const prefix = idPrefix(useId());
    return (
        <Prefix.Provider value={prefix}>
            <Flow.Root<Types, typeof features>
                features={features}
                defaultNodes={nodes}
                defaultEdges={edges}
                fitView={{ padding: 0.15, maxZoom: 1 }}
                role="group"
                aria-label="Edge markers"
                className={styles.root}
            >
                <Flow.Background
                    variant="dots"
                    size={2}
                    className={styles.dots}
                />
                <Flow.Background variant="lines" className={styles.lines} />
                <Flow.Background variant="cross" className={styles.cross} />
                <Flow.Viewport>
                    <Flow.Edges<Types>>{renderEdge}</Flow.Edges>
                    <Flow.Nodes<Types>>{renderNode}</Flow.Nodes>
                </Flow.Viewport>
                <MarkerDefs prefix={prefix} />
            </Flow.Root>
        </Prefix.Provider>
    );
}
