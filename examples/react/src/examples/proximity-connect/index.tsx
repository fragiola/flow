import {
    Flow,
    type FlowEdge,
    type FlowEngine,
    type FlowEngineEventOf,
    type FlowJson,
    type FlowModel,
    type FlowNode,
    type FlowTypes,
    useFlowRef,
    useFlowStore,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import { selection } from "@fragiola/flow-react/selection";
import { useState } from "react";
import { type Link, type Placed, proximityLink, sameLink } from "./proximity";
import { styles } from "./styles";

// Connecting by proximity: drag a node near another and a dashed line shows the edge it would
// make, to the closest node within `MAX_GAP` (flow units between the two boxes) that it is not
// joined to yet; drop it there and the edge is added. The dashed line is the example's own state,
// never the document's: `drag-start` (`onNodeDragStart`) says which node is dragged, a store
// (`useFlowStore`) reads every node's box (`engine.get("node-rect-by")`) while it moves and keeps
// the closest one, and the drop (`nodes-move`, `onNodesMove`) runs `edge.add` when there is one.
// The geometry is framework-free, in `proximity.ts`.

interface Types extends FlowTypes {
    readonly nodes: { step: { label: string } };
}

const features = [selection(), drag(), keyboard()] as const;

/** How close (flow units of empty space between two nodes) a drop must be to connect. */
const MAX_GAP = 80;

const step = (id: string, label: string, x: number, y: number) => ({
    id,
    type: "step" as const,
    position: { x, y },
    width: 140,
    height: 56,
    data: { label },
});

const json: FlowJson<Types> = {
    version: 1,
    nodes: [
        step("fetch", "Fetch", 0, 0),
        step("parse", "Parse", 320, 0),
        step("store", "Store", 640, 0),
        step("notify", "Notify", 160, 280),
        step("log", "Log", 480, 280),
    ],
    edges: [{ id: "fetch-parse", source: "fetch", target: "parse" }],
};

/** The node's labels, for the edges' names. */
const LABELS: Record<string, string> = Object.fromEntries(
    json.nodes.map((node) => [node.id, node.data.label]),
);

/** The edge a dragged node would make now, from every node's box on screen, or none. */
function linkFor(
    model: FlowModel<Types, typeof features>,
    engine: FlowEngine<Types, typeof features>,
    nodeId: string,
): Link | undefined {
    const placed: Placed[] = [];
    for (const node of model.get("all-nodes")) {
        const box = engine.get("node-rect-by", { nodeId: node.id });
        if (box && box.width > 0) placed.push({ id: node.id, box });
    }
    const dragged = placed.find((item) => item.id === nodeId);
    if (!dragged) return undefined;
    return proximityLink(dragged, placed, model.get("all-edges"), MAX_GAP);
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

function renderEdge(edge: FlowEdge<Types>) {
    return (
        <Flow.Edge<Types>
            edge={edge}
            role="group"
            aria-roledescription="edge"
            aria-label={`${LABELS[edge.source] ?? edge.source} to ${LABELS[edge.target] ?? edge.target}`}
            className={styles.edgeGroup}
        >
            <Flow.EdgePath className={styles.edge} />
        </Flow.Edge>
    );
}

/**
 * The temporary edge: a dashed line in flow coordinates, inside the viewport, while the dragged
 * node is near another. Not a `Flow.Edge`: it is not in the document, nor focusable.
 */
function TemporaryEdge({ nodeId }: { nodeId: string }) {
    const link = useFlowStore<Link | undefined, Types, typeof features>(
        ({ model, engine }) => linkFor(model, engine, nodeId),
        sameLink,
    );
    if (!link) return null;
    return (
        <svg aria-hidden="true" className={styles.overlay}>
            <line
                data-testid="temporary-edge"
                data-source={link.source}
                data-target={link.target}
                x1={link.from.x}
                y1={link.from.y}
                x2={link.to.x}
                y2={link.to.y}
                className={styles.temporary}
            />
        </svg>
    );
}

export default function ProximityConnect() {
    const flow = useFlowRef<Types, typeof features>();
    // the node being dragged alone, while it is: app state, never the document's
    const [dragged, setDragged] = useState<string>();

    function onNodeDragStart(event: FlowEngineEventOf<"drag-start">) {
        setDragged(event.nodeIds.length === 1 ? event.nodeIds[0] : undefined);
    }

    /** The drop: the edge the temporary line showed, if any, becomes a real one. */
    function onNodesMove(event: FlowEngineEventOf<"nodes-move">) {
        const nodeId = dragged;
        setDragged(undefined);
        const current = flow.current;
        if (!current || event.source !== "pointer" || nodeId === undefined)
            return;
        const link = linkFor(current.model, current.engine, nodeId);
        if (!link) return;
        current.model.run("edge.add", {
            id: `${link.source}-${link.target}`,
            source: link.source,
            target: link.target,
        });
    }

    return (
        <Flow.Root<Types, typeof features>
            features={features}
            defaultNodes={json.nodes}
            defaultEdges={json.edges}
            fitView={{ padding: 0.2, maxZoom: 1 }}
            flowRef={flow}
            onNodeDragStart={onNodeDragStart}
            onNodesMove={onNodesMove}
            onNodeDragCancel={() => setDragged(undefined)}
            role="group"
            aria-label="Proximity connect"
            className={styles.root}
        >
            <Flow.Background variant="dots" size={2} className={styles.dots} />
            <Flow.Background variant="lines" className={styles.lines} />
            <Flow.Background variant="cross" className={styles.cross} />
            <Flow.Viewport>
                <Flow.Edges<Types>>{renderEdge}</Flow.Edges>
                {dragged !== undefined && <TemporaryEdge nodeId={dragged} />}
                <Flow.Nodes<Types>>{renderNode}</Flow.Nodes>
            </Flow.Viewport>
            <p className={styles.hint}>
                Drag a node close to another one and drop it to connect them
            </p>
        </Flow.Root>
    );
}
