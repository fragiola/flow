import {
    Flow,
    type FlowEdge,
    type FlowEdgeInput,
    type FlowEngineEventOf,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
    useFlowRef,
} from "@fragiola/flow-react";
import { connection } from "@fragiola/flow-react/connection";
import { drag } from "@fragiola/flow-react/drag";
import { reconnection } from "@fragiola/flow-react/reconnection";
import { selection } from "@fragiola/flow-react/selection";
import { useState } from "react";
import { styles } from "./styles";

// `reconnection()` (it needs `connection()`) lets an edge's end move: press a `Flow.ReconnectAnchor`
// (drawn here as a ring at each end) or the stroke near an end, and drop it on another handle. The
// edge keeps its id (`edge.reconnect`); dropped nowhere or on a refused handle, it goes back. The
// "locked" edge is not reconnectable (`reconnectable: false`).
//
// "Delete on drop" is app policy over the `reconnect-cancel` event (`onReconnectCancel`): an end
// released over no handle (`dropped`, no `to`, not `refused`) removes its edge with `edge.remove`.

interface Types extends FlowTypes {
    readonly nodes: { device: { label: string } };
}

const features = [selection(), drag(), connection(), reconnection()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "router",
        type: "device",
        position: { x: 0, y: 100 },
        data: { label: "Router" },
    },
    {
        id: "laptop",
        type: "device",
        position: { x: 300, y: 0 },
        data: { label: "Laptop" },
    },
    {
        id: "printer",
        type: "device",
        position: { x: 300, y: 120 },
        data: { label: "Printer" },
    },
    {
        id: "tv",
        type: "device",
        position: { x: 300, y: 240 },
        data: { label: "TV" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "router-laptop", source: "router", target: "laptop" },
    { id: "router-tv", source: "router", target: "tv", reconnectable: false },
];

// module functions: the same children on every render, so the flow never re-renders every part
function renderEdge(edge: FlowEdge<Types>) {
    return (
        <Flow.Edge<Types> edge={edge} className={styles.edgeGroup}>
            <Flow.EdgePath className={styles.edge} />
            {edge.reconnectable === false ? (
                <Flow.EdgeLabel className={styles.label}>locked</Flow.EdgeLabel>
            ) : (
                <>
                    <Flow.ReconnectAnchor
                        end="source"
                        className={styles.anchor}
                    />
                    <Flow.ReconnectAnchor
                        end="target"
                        className={styles.anchor}
                    />
                </>
            )}
        </Flow.Edge>
    );
}

function renderNode(node: FlowNode<Types>) {
    return (
        <Flow.Node<Types> node={node} className={styles.node}>
            {node.data.label}
            <Flow.Handle type="target" side="left" className={styles.handle} />
            <Flow.Handle type="source" side="right" className={styles.handle} />
        </Flow.Node>
    );
}

export default function EdgeReconnect() {
    const flow = useFlowRef<Types, typeof features>();
    const [deleteOnDrop, setDeleteOnDrop] = useState(false);

    /** An end dropped on the pane, with "Delete on drop" on: the edge goes. */
    function onReconnectCancel(event: FlowEngineEventOf<"reconnect-cancel">) {
        if (!deleteOnDrop || !event.dropped || event.to || event.refused) {
            return;
        }
        flow.current?.model.run("edge.remove", { edgeId: event.edgeId });
    }

    return (
        <Flow.Root<Types, typeof features>
            features={features}
            defaultNodes={nodes}
            defaultEdges={edges}
            fitView={{ padding: 0.2, maxZoom: 1 }}
            flowRef={flow}
            onReconnectCancel={onReconnectCancel}
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
            <label data-flow-no-gesture className={styles.option}>
                <input
                    type="checkbox"
                    role="switch"
                    checked={deleteOnDrop}
                    aria-checked={deleteOnDrop}
                    onChange={(event) => setDeleteOnDrop(event.target.checked)}
                    className={styles.switch}
                />
                Delete on drop
            </label>
        </Flow.Root>
    );
}
