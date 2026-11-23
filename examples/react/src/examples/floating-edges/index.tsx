import {
    bezierPath,
    Flow,
    type FlowEdge,
    type FlowEdgeInput,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
    type InternalNode,
    straightPath,
    useInternalNode,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import { selection } from "@fragiola/flow-react/selection";
import { createContext, useContext, useId, useState } from "react";
import {
    type Box,
    type Ends,
    floatingEnds,
    type Shape,
    simpleEnds,
} from "./border-intersection";
import { styles } from "./styles";

// Floating edges: no handle anywhere. Each edge reads its two nodes' boxes as the engine places
// them (`useInternalNode(id).rect`, which re-renders the edge while a node is dragged) and draws
// itself between their borders (`border-intersection.ts`): where the line between the centres
// leaves a rectangle, or the ellipse of a round node, drawn straight or as a bezier that leaves
// and enters square to the side it meets; or, "simple", from the middle of each node's side
// nearest the other. The path itself comes from the core's helpers (`straightPath`,
// `bezierPath`). Pick the variant above the flow; the edges say theirs (`data-variant`).

interface Types extends FlowTypes {
    readonly nodes: { shape: { label: string; shape: Shape } };
}

type Variant = "straight" | "bezier" | "simple";

const VARIANTS: readonly { value: Variant; label: string }[] = [
    { value: "straight", label: "Straight" },
    { value: "bezier", label: "Bezier" },
    { value: "simple", label: "Simple" },
];

const features = [selection(), drag(), keyboard()] as const;

const shape = (
    id: string,
    label: string,
    kind: Shape,
    x: number,
    y: number,
    width: number,
    height: number,
): FlowNodeInput<Types> => ({
    id,
    type: "shape",
    position: { x, y },
    width,
    height,
    data: { label, shape: kind },
});

const nodes: FlowNodeInput<Types>[] = [
    shape("hub", "Hub", "ellipse", 300, 180, 110, 110),
    shape("wide", "Wide box", "rect", 0, 20, 220, 64),
    shape("tall", "Tall box", "rect", 620, 0, 96, 150),
    shape("oval", "Oval", "ellipse", 20, 380, 180, 84),
    shape("square", "Square", "rect", 600, 380, 100, 100),
];

const link = (source: string, target: string): FlowEdgeInput<Types> => ({
    id: `${source}-${target}`,
    source,
    target,
});

const edges: FlowEdgeInput<Types>[] = [
    link("hub", "wide"),
    link("hub", "tall"),
    link("oval", "hub"),
    link("square", "hub"),
    link("wide", "oval"),
    link("tall", "square"),
];

const LABELS: Record<string, string> = Object.fromEntries(
    nodes.map((node) => [node.id, node.data.label]),
);

const VariantContext = createContext<Variant>("straight");

/** A node's box as the engine places it, with its shape: what the border geometry reads. */
function boxOf(node: InternalNode<Types>): Box {
    return { ...node.rect, shape: node.node.data.shape };
}

/** The path of a variant between two nodes. */
function floatingPath(variant: Variant, source: Box, target: Box) {
    if (variant === "simple") {
        const ends = simpleEnds(source, target);
        return { ends, path: bezierPath(ends).path };
    }
    const ends: Ends = floatingEnds(source, target);
    const path =
        variant === "bezier" ? bezierPath(ends).path : straightPath(ends).path;
    return { ends, path };
}

function FloatingEdge({ edge }: { edge: FlowEdge<Types> }) {
    const variant = useContext(VariantContext);
    // both nodes' boxes, followed while they move
    const source = useInternalNode<Types>(edge.source);
    const target = useInternalNode<Types>(edge.target);
    if (!source?.measured || !target?.measured) return null;
    const { ends, path } = floatingPath(variant, boxOf(source), boxOf(target));
    return (
        <Flow.Edge<Types>
            edge={edge}
            role="group"
            aria-roledescription="edge"
            aria-label={`${LABELS[edge.source]} to ${LABELS[edge.target]}`}
            data-variant={variant}
            className={styles.edgeGroup}
        >
            {/* a wide transparent path: a bigger target for a click */}
            <Flow.EdgePath d={path} className={styles.edgeHit} />
            <Flow.EdgePath d={path} className={styles.edge} />
            {/* where the edge meets each border */}
            <circle
                cx={ends.source.x}
                cy={ends.source.y}
                r={3}
                className={styles.end}
            />
            <circle
                cx={ends.target.x}
                cy={ends.target.y}
                r={3}
                className={styles.end}
            />
        </Flow.Edge>
    );
}

function renderEdge(edge: FlowEdge<Types>) {
    return <FloatingEdge edge={edge} />;
}

function renderNode(node: FlowNode<Types>) {
    const { label } = node.data;
    return (
        <Flow.Node<Types>
            node={node}
            role="group"
            aria-roledescription="node"
            aria-label={label}
            className={styles.node(node.data.shape)}
        >
            {label}
        </Flow.Node>
    );
}

export default function FloatingEdges() {
    const [variant, setVariant] = useState<Variant>("straight");
    // the radios' group name, unique to this flow: two of them on a page never share it
    const group = useId();
    return (
        <VariantContext.Provider value={variant}>
            <Flow.Root<Types, typeof features>
                features={features}
                defaultNodes={nodes}
                defaultEdges={edges}
                fitView={{ padding: 0.15, maxZoom: 1 }}
                role="group"
                aria-label="Floating edges"
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
                <fieldset className={styles.panel}>
                    <legend className={styles.legend}>Edge path</legend>
                    {VARIANTS.map((option) => (
                        <label key={option.value} className={styles.option}>
                            <input
                                type="radio"
                                name={group}
                                value={option.value}
                                checked={variant === option.value}
                                onChange={() => setVariant(option.value)}
                                className={styles.radio}
                            />
                            {option.label}
                        </label>
                    ))}
                </fieldset>
            </Flow.Root>
        </VariantContext.Provider>
    );
}
