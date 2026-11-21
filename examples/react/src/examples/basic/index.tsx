import {
    Flow,
    type FlowEdgeInput,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-react";
import { connection } from "@fragiola/flow-react/connection";
import { drag } from "@fragiola/flow-react/drag";
import { selection } from "@fragiola/flow-react/selection";
import { styles } from "./styles";

// The smallest flow: four nodes and three edges. The root fills its frame (give it a size); the
// background sits behind the viewport, and inside it the edges come before the nodes so the nodes
// are drawn on top. Pan by dragging the canvas, zoom with the wheel or a pinch, drag a node, and
// draw an edge from a node's bottom handle to another node's top handle.

interface Types extends FlowTypes {
    readonly nodes: { step: { label: string } };
}

const features = [selection(), drag(), connection()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "start",
        type: "step",
        position: { x: 0, y: 0 },
        data: { label: "Start" },
    },
    {
        id: "fetch",
        type: "step",
        position: { x: -160, y: 140 },
        data: { label: "Fetch data" },
    },
    {
        id: "parse",
        type: "step",
        position: { x: 160, y: 140 },
        data: { label: "Parse file" },
    },
    {
        id: "save",
        type: "step",
        position: { x: 0, y: 280 },
        data: { label: "Save" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "start-fetch", source: "start", target: "fetch" },
    { id: "start-parse", source: "start", target: "parse" },
    { id: "fetch-save", source: "fetch", target: "save" },
];

export default function BasicFlow() {
    return (
        <Flow.Root<Types, typeof features>
            features={features}
            defaultNodes={nodes}
            defaultEdges={edges}
            fitView={{ padding: 0.2, maxZoom: 1 }}
            className={styles.root}
        >
            {/* one layer per pattern: the theme shows the one it picks */}
            <Flow.Background variant="dots" size={2} className={styles.dots} />
            <Flow.Background variant="lines" className={styles.lines} />
            <Flow.Background variant="cross" className={styles.cross} />
            <Flow.Viewport>
                <Flow.Edges<Types>>
                    {(edge) => (
                        <Flow.Edge<Types> edge={edge}>
                            <Flow.EdgePath className={styles.edge} />
                        </Flow.Edge>
                    )}
                </Flow.Edges>
                <Flow.Nodes<Types>>
                    {(node) => (
                        <Flow.Node<Types> node={node} className={styles.node}>
                            {node.data.label}
                            <Flow.Handle
                                type="target"
                                side="top"
                                className={styles.handle}
                            />
                            <Flow.Handle
                                type="source"
                                side="bottom"
                                className={styles.handle}
                            />
                        </Flow.Node>
                    )}
                </Flow.Nodes>
                <Flow.ConnectionLine className={styles.connection} />
            </Flow.Viewport>
        </Flow.Root>
    );
}
