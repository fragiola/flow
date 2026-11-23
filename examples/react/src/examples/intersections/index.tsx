import {
    Flow,
    type FlowEdge,
    type FlowEngineEventOf,
    type FlowJson,
    type FlowNode,
    type FlowTypes,
    useFlowRef,
    useFlowStore,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import { selection } from "@fragiola/flow-react/selection";
import { useState } from "react";
import { type Placed, resolveCollisions } from "./collisions";
import { pathCrossesBox } from "./crossing";
import { styles } from "./styles";

// While nodes are dragged, what they run into is marked `data-intersecting`: the nodes they
// overlap (`engine.get("intersecting-nodes", { nodeId })`, the engine's own test) and the edges
// whose path crosses them (`edge-path-by`'s path against the dragged node's `node-rect-by`, in
// `crossing.ts`). Each node and edge reads it from a store (`useFlowStore`) over the nodes being
// dragged (`dragging-node-ids`), so the marks follow the drag and clear on the drop.
//
// "Resolve collisions" is app policy over the drop (`nodes-move`, `onNodesMove`): the dropped
// nodes stay, and the nodes they overlap are pushed away until none does (`collisions.ts`), every
// move in one `batch`: one step, one undo.

interface Types extends FlowTypes {
    readonly nodes: { step: { label: string } };
}

const features = [selection(), drag(), keyboard()] as const;

/** The empty space (flow units) the resolver keeps between two nodes. */
const MARGIN = 16;

const step = (id: string, label: string, x: number, y: number) => ({
    id,
    type: "step" as const,
    position: { x, y },
    width: 140,
    height: 56,
    data: { label },
});

const link = (source: string, target: string) => ({
    id: `${source}-${target}`,
    source,
    target,
});

const json: FlowJson<Types> = {
    version: 1,
    nodes: [
        step("fetch", "Fetch", 0, 0),
        step("store", "Store", 520, 0),
        step("parse", "Parse", 260, 160),
        step("index", "Index", 520, 160),
        step("notify", "Notify", 0, 320),
        step("log", "Log", 260, 320),
    ],
    edges: [
        link("fetch", "store"),
        link("parse", "index"),
        link("notify", "log"),
    ],
};

/** The node's labels, for the edges' names. */
const LABELS: Record<string, string> = Object.fromEntries(
    json.nodes.map((node) => [node.id, node.data.label]),
);

const labelOf = (id: string) => LABELS[id] ?? id;

/** A node, marked while a dragged node overlaps it. */
function StepNode({ node }: { node: FlowNode<Types> }) {
    const intersecting = useFlowStore<boolean, Types, typeof features>(
        ({ engine }) => {
            const dragging = engine.get("dragging-node-ids");
            if (dragging.length === 0 || dragging.includes(node.id)) {
                return false;
            }
            return engine
                .get("intersecting-nodes", { nodeId: node.id })
                .some((other) => dragging.includes(other.id));
        },
    );
    const { label } = node.data;
    return (
        <Flow.Node<Types>
            node={node}
            role="group"
            aria-roledescription="node"
            aria-label={label}
            data-intersecting={intersecting ? "" : undefined}
            className={styles.node}
        >
            <Flow.Handle type="target" side="left" className={styles.handle} />
            {label}
            <Flow.Handle type="source" side="right" className={styles.handle} />
        </Flow.Node>
    );
}

/** An edge, marked while its path crosses a dragged node that is not one of its ends. */
function LinkEdge({ edge }: { edge: FlowEdge<Types> }) {
    const intersecting = useFlowStore<boolean, Types, typeof features>(
        ({ engine }) => {
            const dragging = engine
                .get("dragging-node-ids")
                .filter((id) => id !== edge.source && id !== edge.target);
            if (dragging.length === 0) return false;
            const drawn = engine.get("edge-path-by", { edgeId: edge.id });
            if (!drawn) return false;
            return dragging.some((nodeId) => {
                const box = engine.get("node-rect-by", { nodeId });
                return box !== undefined && box.width > 0
                    ? pathCrossesBox(drawn.path, box)
                    : false;
            });
        },
    );
    return (
        <Flow.Edge<Types>
            edge={edge}
            role="group"
            aria-roledescription="edge"
            aria-label={`${labelOf(edge.source)} to ${labelOf(edge.target)}`}
            data-intersecting={intersecting ? "" : undefined}
            className={styles.edgeGroup}
        >
            <Flow.EdgePath className={styles.edge} />
        </Flow.Edge>
    );
}

function renderNode(node: FlowNode<Types>) {
    return <StepNode node={node} />;
}

function renderEdge(edge: FlowEdge<Types>) {
    return <LinkEdge edge={edge} />;
}

export default function Intersections() {
    const flow = useFlowRef<Types, typeof features>();
    const [resolve, setResolve] = useState(false);

    /** A drop with "Resolve collisions" on: the dropped nodes stay, the others make room. */
    function onNodesMove(event: FlowEngineEventOf<"nodes-move">) {
        const current = flow.current;
        if (!resolve || !current || event.source !== "pointer") return;
        const placed: Placed[] = [];
        for (const node of current.model.get("all-nodes")) {
            const box = current.engine.get("node-rect-by", { nodeId: node.id });
            if (box && box.width > 0) placed.push({ id: node.id, box });
        }
        const moved = resolveCollisions(placed, {
            fixed: event.nodeIds,
            margin: MARGIN,
        });
        if (moved.length === 0) return;
        current.model.run("batch", {
            commands: moved.map(({ id, position }) => ({
                command: "node.move" as const,
                payload: { nodeId: id, position },
            })),
        });
    }

    return (
        <Flow.Root<Types, typeof features>
            features={features}
            defaultNodes={json.nodes}
            defaultEdges={json.edges}
            fitView={{ padding: 0.2, maxZoom: 1 }}
            flowRef={flow}
            onNodesMove={onNodesMove}
            role="group"
            aria-label="Intersections"
            className={styles.root}
        >
            <Flow.Background variant="dots" size={2} className={styles.dots} />
            <Flow.Background variant="lines" className={styles.lines} />
            <Flow.Background variant="cross" className={styles.cross} />
            <Flow.Viewport>
                <Flow.Edges<Types>>{renderEdge}</Flow.Edges>
                <Flow.Nodes<Types>>{renderNode}</Flow.Nodes>
            </Flow.Viewport>
            <label data-flow-no-gesture className={styles.option}>
                <input
                    type="checkbox"
                    role="switch"
                    checked={resolve}
                    aria-checked={resolve}
                    onChange={(event) => setResolve(event.target.checked)}
                    className={styles.switch}
                />
                Resolve collisions
            </label>
            <p className={styles.hint}>
                Drag a node over another one or across an edge
            </p>
        </Flow.Root>
    );
}
