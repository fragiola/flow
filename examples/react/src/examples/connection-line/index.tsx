import {
    type Connection,
    createFlowModel,
    Flow,
    type FlowEdge,
    type FlowEngineEventOf,
    type FlowJson,
    type FlowModel,
    type FlowNode,
    type FlowTypes,
    type Middleware,
    useFlowStore,
    veto,
} from "@fragiola/flow-react";
import { connection } from "@fragiola/flow-react/connection";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import { selection } from "@fragiola/flow-react/selection";
import { useState } from "react";
import {
    edgesToAdd,
    elbowPath,
    otherSources,
    type Start,
    sameStarts,
} from "./multi-connection";
import { styles } from "./styles";

// A connection line of the app's own: `Flow.ConnectionLine`'s children draw it, an elbow with a
// ring at its end (`multi-connection.ts`), and read the line's `data-valid` / `data-invalid` to
// colour it (a locked node, or an edge that exists already, is refused by a middleware). And a
// connection from several nodes at once, which the library does not have: with several nodes
// selected (Shift-click), a drag from one of their handles draws a line from each of them (the
// other lines come from `useFlowStore`: the selection and each node's source handle), and when
// the drop adds the edge (`connect`, `onConnect`) the example adds the others in one `batch`.

interface Types extends FlowTypes {
    readonly nodes: { device: { label: string; locked: boolean } };
}

const features = [selection(), drag(), connection(), keyboard()] as const;

/** Refuses an edge into a locked node, and an edge that exists already. */
const rules: Middleware<Types, typeof features> = (ctx, next) => {
    if (ctx.command !== "edge.add") return next();
    const { source, target, targetHandle } = ctx.payload;
    const into = ctx.state.nodes.find((node) => node.id === target);
    if (into?.data.locked) return veto("a locked node takes no new edge");
    const taken = ctx.state.edges.some(
        (edge) =>
            edge.source === source &&
            edge.target === target &&
            edge.targetHandle === targetHandle,
    );
    return taken ? veto("that edge exists already") : next();
};

const device = (
    id: string,
    label: string,
    x: number,
    y: number,
    locked = false,
) => ({
    id,
    type: "device" as const,
    position: { x, y },
    width: 140,
    height: 48,
    data: { label, locked },
});

const json: FlowJson<Types> = {
    version: 1,
    nodes: [
        device("camera", "Camera", 0, 0),
        device("microphone", "Microphone", 0, 100),
        device("sensor", "Sensor", 0, 200),
        device("recorder", "Recorder", 380, 20),
        device("monitor", "Monitor", 380, 130),
        device("archive", "Archive (locked)", 380, 240, true),
    ],
    edges: [{ id: "camera-recorder", source: "camera", target: "recorder" }],
};

/** The node's labels, for the names. */
const LABELS: Record<string, string> = Object.fromEntries(
    json.nodes.map((node) => [node.id, node.data.label]),
);
const label = (id: string) => LABELS[id] ?? id;

function renderNode(node: FlowNode<Types>) {
    const { label, locked } = node.data;
    return (
        <Flow.Node<Types>
            node={node}
            role="group"
            aria-roledescription="node"
            aria-label={label}
            className={styles.node(locked)}
        >
            <Flow.Handle
                type="target"
                side="left"
                aria-label={`Into ${label}`}
                className={styles.handle}
            />
            {label}
            <Flow.Handle
                type="source"
                side="right"
                aria-label={`Connect from ${label}`}
                className={styles.handle}
            />
        </Flow.Node>
    );
}

function renderEdge(edge: FlowEdge<Types>) {
    return (
        <Flow.Edge<Types>
            edge={edge}
            role="group"
            aria-roledescription="edge"
            aria-label={`${label(edge.source)} to ${label(edge.target)}`}
            className={styles.edgeGroup}
        >
            <Flow.EdgePath className={styles.edge} />
        </Flow.Edge>
    );
}

/**
 * The connection line's drawing, in flow coordinates: an elbow from the pressed handle, one from
 * each other selected node's source handle, and a ring where they meet.
 */
function Lines({ connection }: { connection: Connection }) {
    const starts = useFlowStore<readonly Start[], Types, typeof features>(
        ({ model, engine }) =>
            otherSources(
                connection.from.nodeId,
                model.get("selected-nodes").map((node) => node.id),
            ).flatMap((nodeId) => {
                const center = engine
                    .get("handles-by", { nodeId })
                    .find((handle) => handle.type === "source")?.center;
                return center ? [{ id: nodeId, ...center }] : [];
            }),
        sameStarts,
    );
    const to = connection.toPoint;
    return (
        <>
            {starts.map((start) => (
                <path
                    key={start.id}
                    data-testid="extra-line"
                    data-source={start.id}
                    d={elbowPath(start, to)}
                    className={styles.extra}
                />
            ))}
            <path
                data-testid="custom-line"
                d={elbowPath(connection.fromPoint, to)}
                className={styles.line}
            />
            <circle cx={to.x} cy={to.y} r={5} className={styles.end} />
        </>
    );
}

function renderLine(connection: Connection) {
    return <Lines connection={connection} />;
}

export default function ConnectionLine() {
    // the model is made once, with its middleware, and handed to the root
    const [model] = useState<FlowModel<Types, typeof features>>(() => {
        const created = createFlowModel<Types, typeof features>(json, {
            features,
        });
        created.use(rules);
        return created;
    });
    const [outcome, setOutcome] = useState(
        "Shift-click nodes to select several, then drag from one of their handles.",
    );

    /** The drop added one edge: the other selected nodes get theirs, in one batch. */
    function onConnect(event: FlowEngineEventOf<"connect">) {
        const added = model.get("edge-by", { id: event.edgeId });
        const sources = otherSources(
            event.source,
            model.get("selected-nodes").map((node) => node.id),
        );
        const more = edgesToAdd(
            sources,
            event.target,
            added?.targetHandle,
            model.get("all-edges"),
        ).filter((edge) => model.can("edge.add", edge));
        if (more.length > 0) {
            model.run("batch", {
                commands: more.map((edge) => ({
                    command: "edge.add" as const,
                    payload: edge,
                })),
            });
        }
        const from = [event.source, ...more.map((edge) => edge.source)];
        setOutcome(
            `Connected ${from.map(label).join(", ")} to ${label(event.target)}.`,
        );
    }

    function onConnectCancel(event: FlowEngineEventOf<"connect-cancel">) {
        if (event.refused) setOutcome("Refused: that target takes no edge.");
    }

    return (
        <Flow.Root<Types, typeof features>
            model={model}
            fitView={{ padding: 0.2, maxZoom: 1 }}
            onConnect={onConnect}
            onConnectCancel={onConnectCancel}
            role="group"
            aria-label="Connection line"
            className={styles.root}
        >
            <Flow.Background variant="dots" size={2} className={styles.dots} />
            <Flow.Background variant="lines" className={styles.lines} />
            <Flow.Background variant="cross" className={styles.cross} />
            <Flow.Viewport>
                <Flow.Edges<Types>>{renderEdge}</Flow.Edges>
                <Flow.Nodes<Types>>{renderNode}</Flow.Nodes>
                <Flow.ConnectionLine className={styles.connection}>
                    {renderLine}
                </Flow.ConnectionLine>
            </Flow.Viewport>
            <p role="status" data-testid="outcome" className={styles.status}>
                {outcome}
            </p>
        </Flow.Root>
    );
}
