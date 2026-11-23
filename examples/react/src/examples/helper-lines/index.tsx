import {
    createFlowModel,
    Flow,
    type FlowEdge,
    type FlowJson,
    type FlowModel,
    type FlowNode,
    type FlowTypes,
    useFlowStore,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import { selection } from "@fragiola/flow-react/selection";
import { useState } from "react";
import { type Guide, guidesOf, sameGuides } from "./alignment";
import { boxOf, othersOf, snapToLines } from "./snapping";
import { styles } from "./styles";

// Helper lines: while a node is dragged alone, a guide is drawn wherever one of its edges or its
// centre lines up with another node's, and the node snaps onto those lines when it comes within
// `SNAP` flow units of them. The snap is a middleware (`snapping.ts`, `model.use`): it rewrites the
// position of the drag's `node.move` steps (run as `transient`) and of the drop, so the document
// only ever holds the snapped position. The guides are the example's own state, never the
// document's: a store (`useFlowStore`) reads the dragged node (`dragging-node-ids`) and where it
// lines up now (`alignment.ts`), and draws them in flow coordinates inside the viewport; the drop
// ends the drag and clears them.

interface Types extends FlowTypes {
    readonly nodes: { card: { label: string } };
}

const features = [selection(), drag(), keyboard()] as const;

/** How near (flow units) a dragged node's line must come to another's to snap onto it. */
const SNAP = 8;

/** How far (flow units) a guide runs past the boxes it joins. */
const OVERHANG = 12;

const card = (
    id: string,
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
) => ({
    id,
    type: "card" as const,
    position: { x, y },
    width,
    height,
    data: { label },
});

const json: FlowJson<Types> = {
    version: 1,
    nodes: [
        card("draft", "Draft", 0, 0, 160, 60),
        card("review", "Review", 280, 110, 120, 80),
        card("publish", "Publish", 36, 250, 180, 60),
    ],
    edges: [
        { id: "draft-review", source: "draft", target: "review" },
        { id: "review-publish", source: "review", target: "publish" },
    ],
};

/** The node's labels, for the edges' names. */
const LABELS: Record<string, string> = Object.fromEntries(
    json.nodes.map((node) => [node.id, node.data.label]),
);

const labelOf = (id: string) => LABELS[id] ?? id;

/** A position as the node prints it: a tenth at most. */
const printed = (value: number) => Number(value.toFixed(1));

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
            <span data-testid="position" className={styles.position}>
                {printed(node.position.x)}, {printed(node.position.y)}
            </span>
            <Flow.Handle type="source" side="right" className={styles.handle} />
        </Flow.Node>
    );
}

function renderEdge(edge: FlowEdge<Types>) {
    return (
        <Flow.Edge<Types>
            edge={edge}
            role="group"
            aria-roledescription="edge"
            aria-label={`${labelOf(edge.source)} to ${labelOf(edge.target)}`}
            className={styles.edgeGroup}
        >
            <Flow.EdgePath className={styles.edge} />
        </Flow.Edge>
    );
}

const NONE: Guide[] = [];

/**
 * The guides of the node being dragged alone, in flow coordinates inside the viewport: a vertical
 * line (`data-axis="x"`) where an x lines up, a horizontal one (`data-axis="y"`) where a y does.
 */
function HelperLines() {
    const guides = useFlowStore<Guide[], Types, typeof features>(
        ({ model, engine }) => {
            const dragging = engine.get("dragging-node-ids");
            const nodeId = dragging.length === 1 ? dragging[0] : undefined;
            if (nodeId === undefined) return NONE;
            const node = model.get("node-by", { id: nodeId });
            if (!node || node.parentId !== undefined) return NONE;
            return guidesOf(
                boxOf(node),
                othersOf(model.get("all-nodes"), nodeId),
            );
        },
        sameGuides,
    );
    if (guides.length === 0) return null;
    return (
        <svg aria-hidden="true" className={styles.overlay}>
            {guides.map((guide) => {
                const from = guide.from - OVERHANG;
                const to = guide.to + OVERHANG;
                return (
                    <line
                        key={`${guide.axis}-${guide.at}`}
                        data-testid="guide"
                        data-axis={guide.axis}
                        data-at={guide.at}
                        x1={guide.axis === "x" ? guide.at : from}
                        y1={guide.axis === "x" ? from : guide.at}
                        x2={guide.axis === "x" ? guide.at : to}
                        y2={guide.axis === "x" ? to : guide.at}
                        className={styles.guide}
                    />
                );
            })}
        </svg>
    );
}

export default function HelperLinesExample() {
    // the model is made once, with the snap as its middleware, and handed to the root
    const [model] = useState<FlowModel<Types, typeof features>>(() => {
        const created = createFlowModel<Types, typeof features>(json, {
            features,
        });
        created.use(snapToLines(SNAP));
        return created;
    });
    return (
        <Flow.Root<Types, typeof features>
            model={model}
            fitView={{ padding: 0.2, maxZoom: 1 }}
            role="group"
            aria-label="Helper lines"
            className={styles.root}
        >
            <Flow.Background variant="dots" size={2} className={styles.dots} />
            <Flow.Background variant="lines" className={styles.lines} />
            <Flow.Background variant="cross" className={styles.cross} />
            <Flow.Viewport>
                <Flow.Edges<Types>>{renderEdge}</Flow.Edges>
                <Flow.Nodes<Types>>{renderNode}</Flow.Nodes>
                <HelperLines />
            </Flow.Viewport>
            <p className={styles.hint}>
                Drag a node until its edges or centre line up with another one
            </p>
        </Flow.Root>
    );
}
