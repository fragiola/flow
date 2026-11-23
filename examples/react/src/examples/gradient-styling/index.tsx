import {
    Flow,
    type FlowEdge,
    type FlowEdgeInput,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
    useEdge,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import { selection } from "@fragiola/flow-react/selection";
import {
    BellRingIcon,
    BracesIcon,
    DatabaseIcon,
    FileTextIcon,
    type LucideIcon,
    ShieldCheckIcon,
} from "lucide-react";
import { createContext, useContext, useId } from "react";
import {
    describeStep,
    edgeGradient,
    gradientId,
    gradientUrl,
    idPrefix,
    type Kind,
} from "./gradients";
import { styles } from "./styles";

// A look of the app's own, every colour a palette's accent so it follows the five themes. A node's
// border is a gradient between two palettes (its kind's, `gradients.ts`): the node sits in the
// first, a frame inside it in the second, and the frame paints the gradient around the body.
// Selected (`data-selected`), the node glows in its own colour. An edge's stroke is an SVG
// `<linearGradient>` of its own, from its source's colour to its target's: drawn in flow
// coordinates (`userSpaceOnUse`) between the edge's ends (`useEdge(edge).state.path`), so it keeps
// its direction while a node moves, and a straight edge (whose box has no height) still paints.
// Its id starts with `useId`, so two of these flows on one page never share one.

interface Types extends FlowTypes {
    readonly nodes: {
        step: { label: string; kind: Kind; detail: string };
    };
}

const features = [selection(), drag(), keyboard()] as const;

const step = (
    id: string,
    label: string,
    kind: Kind,
    detail: string,
    x: number,
    y: number,
) => ({
    id,
    type: "step" as const,
    position: { x, y },
    data: { label, kind, detail },
});

const nodes: FlowNodeInput<Types>[] = [
    step("events", "Events", "source", "events.ndjson", 0, 120),
    step("parse", "Parse", "transform", "JSON lines to rows", 300, 120),
    step("validate", "Validate", "check", "against the schema", 600, 120),
    step("report", "Report", "output", "daily summary", 900, 20),
    step("alerts", "Alerts", "output", "on rejected rows", 900, 220),
];

const ICONS: Record<string, LucideIcon> = {
    events: DatabaseIcon,
    parse: BracesIcon,
    validate: ShieldCheckIcon,
    report: FileTextIcon,
    alerts: BellRingIcon,
};

const link = (source: string, target: string) => ({
    id: `${source}-${target}`,
    source,
    target,
});

const edges: FlowEdgeInput<Types>[] = [
    link("events", "parse"),
    link("parse", "validate"),
    link("validate", "report"),
    link("validate", "alerts"),
];

const STEPS = Object.fromEntries(nodes.map((node) => [node.id, node.data]));

/** This flow's gradient id prefix, for the edges (their render function is a module one). */
const Prefix = createContext("");

function GradientEdge({ edge }: { edge: FlowEdge<Types> }) {
    const prefix = useContext(Prefix);
    const { state } = useEdge<Types>(edge);
    const source = STEPS[edge.source];
    const target = STEPS[edge.target];
    const { from, to } = edgeGradient(
        source?.kind ?? "transform",
        target?.kind ?? "transform",
    );
    const ends = state.path;
    return (
        <Flow.Edge<Types>
            edge={edge}
            role="group"
            aria-roledescription="edge"
            aria-label={`${source?.label} to ${target?.label}`}
            className={styles.edgeGroup}
        >
            <defs>
                <linearGradient
                    id={gradientId(prefix, edge.id)}
                    gradientUnits="userSpaceOnUse"
                    x1={ends?.source.x}
                    y1={ends?.source.y}
                    x2={ends?.target.x}
                    y2={ends?.target.y}
                >
                    <stop offset="0%" className={styles.stop(from)} />
                    <stop offset="100%" className={styles.stop(to)} />
                </linearGradient>
            </defs>
            {/* a wide transparent path: a bigger target for a click */}
            <Flow.EdgePath className={styles.edgeHit} />
            <Flow.EdgePath
                stroke={gradientUrl(prefix, edge.id)}
                className={styles.edge}
            />
        </Flow.Edge>
    );
}

function renderEdge(edge: FlowEdge<Types>) {
    return <GradientEdge edge={edge} />;
}

function renderNode(node: FlowNode<Types>) {
    const { label, kind, detail } = node.data;
    const Icon = ICONS[node.id] ?? BracesIcon;
    return (
        <Flow.Node<Types>
            node={node}
            role="group"
            aria-roledescription="node"
            aria-label={describeStep(label, kind, detail)}
            className={styles.node(kind)}
        >
            <Flow.Handle type="target" side="left" className={styles.handle} />
            <div className={styles.frame(kind)}>
                <div className={styles.body}>
                    <span className={styles.icon}>
                        <Icon />
                    </span>
                    <span className={styles.text}>
                        <span className={styles.title}>{label}</span>
                        <span className={styles.detail}>{detail}</span>
                    </span>
                </div>
            </div>
            <Flow.Handle type="source" side="right" className={styles.handle} />
        </Flow.Node>
    );
}

export default function GradientStyling() {
    const prefix = idPrefix(useId());
    return (
        <Prefix.Provider value={prefix}>
            <Flow.Root<Types, typeof features>
                features={features}
                defaultNodes={nodes}
                defaultEdges={edges}
                fitView={{ padding: 0.15, maxZoom: 1 }}
                role="group"
                aria-label="Gradient styling"
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
            </Flow.Root>
        </Prefix.Provider>
    );
}
