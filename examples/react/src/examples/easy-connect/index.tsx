import {
    createFlowModel,
    Flow,
    type FlowEdge,
    type FlowJson,
    type FlowModel,
    type FlowNode,
    type FlowTypes,
    type Middleware,
    useEdge,
    veto,
} from "@fragiola/flow-react";
import { connection } from "@fragiola/flow-react/connection";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import { selection } from "@fragiola/flow-react/selection";
import type * as React from "react";
import { useState } from "react";
import { floatingLine } from "./floating-edge";
import { styles } from "./styles";

// No small dots to aim at: the whole node is its target, and its border its source. Each node has
// two handles as large as itself: an invisible target handle over all of it, and a source handle
// that is the ring around its body (press the body to drag the node, its border to connect). With
// `mode: "loose"` a connection may end at any handle of another node, and a drop snaps to the
// nearest handle within `radius`: a radius as large as half a node makes anywhere on a node a
// drop. With `clickToConnect`, a tap on a border starts a connection that follows the pointer, and
// a tap on another node ends it. On a touch screen (`pointer: coarse`) the ring grows. Both handles
// sit at the node's centre, so an edge is drawn as a floating line between the borders
// (`floating-edge.ts`). A middleware refuses an edge from a node to itself.

interface Types extends FlowTypes {
    readonly nodes: { step: { label: string } };
}

/** Every node's size: the floating edges cut their line at it. */
const NODE = { width: 140, height: 56 };

const features = [
    selection(),
    drag(),
    connection({
        mode: "loose",
        clickToConnect: true,
        // half a node's diagonal: a drop anywhere on it reaches its centre's handles
        radius: Math.ceil(Math.hypot(NODE.width, NODE.height) / 2) + 4,
        lineType: "straight",
    }),
    keyboard(),
] as const;

/** A node never connects to itself (its own handles are as near as any while you start). */
const noSelfLoop: Middleware<Types, typeof features> = (ctx, next) =>
    ctx.command === "edge.add" && ctx.payload.source === ctx.payload.target
        ? veto("a node does not connect to itself")
        : next();

const step = (id: string, label: string, x: number, y: number) => ({
    id,
    type: "step" as const,
    position: { x, y },
    ...NODE,
    data: { label },
});

const json: FlowJson<Types> = {
    version: 1,
    nodes: [
        step("idea", "Idea", 0, 0),
        step("sketch", "Sketch", 240, 0),
        step("build", "Build", 480, 0),
        step("test", "Test", 120, 170),
        step("ship", "Ship", 380, 170),
    ],
    edges: [{ id: "idea-sketch", source: "idea", target: "sketch" }],
};

/** The node's labels, for the edges' names. */
const LABELS: Record<string, string> = Object.fromEntries(
    json.nodes.map((node) => [node.id, node.data.label]),
);

/** A handle as large as its node: the classes place it, not its side. */
const COVER: React.CSSProperties = {
    top: undefined,
    left: undefined,
    transform: undefined,
};

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
            <Flow.Handle
                type="target"
                side="top"
                connectableStart={false}
                style={COVER}
                className={styles.target}
            />
            <Flow.Handle
                type="source"
                side="bottom"
                aria-label={`Connect from ${label}`}
                style={COVER}
                className={styles.source}
            />
            <div className={styles.body}>{label}</div>
        </Flow.Node>
    );
}

/** A floating edge: a line from border to border, between the two nodes' centres. */
function FloatingEdge({ edge }: { edge: FlowEdge<Types> }) {
    const { state } = useEdge<Types>(edge);
    if (!state.path) return null;
    const { path } = floatingLine(state.path.source, state.path.target, NODE);
    return (
        <Flow.Edge<Types>
            edge={edge}
            role="group"
            aria-roledescription="edge"
            aria-label={`${LABELS[edge.source] ?? edge.source} to ${LABELS[edge.target] ?? edge.target}`}
            className={styles.edgeGroup}
        >
            {/* a wide transparent path: a bigger target for a tap */}
            <Flow.EdgePath d={path} className={styles.edgeHit} />
            <Flow.EdgePath d={path} className={styles.edge} />
        </Flow.Edge>
    );
}

function renderEdge(edge: FlowEdge<Types>) {
    return <FloatingEdge edge={edge} />;
}

export default function EasyConnect() {
    // the model is made once, with its middleware, and handed to the root
    const [model] = useState<FlowModel<Types, typeof features>>(() => {
        const created = createFlowModel<Types, typeof features>(json, {
            features,
        });
        created.use(noSelfLoop);
        return created;
    });
    return (
        <Flow.Root<Types, typeof features>
            model={model}
            fitView={{ padding: 0.2, maxZoom: 1 }}
            role="group"
            aria-label="Easy connect"
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
                Drag from a node's border onto another node, or tap a border and
                then another node
            </p>
        </Flow.Root>
    );
}
