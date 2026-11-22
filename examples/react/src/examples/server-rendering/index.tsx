import {
    Flow,
    type FlowEdgeInput,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { selection } from "@fragiola/flow-react/selection";
import { styles } from "./styles";

// Before the engine exists (on the server, and in the first render in the browser) nothing is
// measured, so the parts draw the document's static geometry: a node at its place, an edge between
// two nodes whose size is known. A node's `width` and `height` fix its size, and its `handles`
// declare where its edges end (a box relative to the node's top-left corner; its centre is the
// end), so these edges are in the server's HTML, and once measured nothing moves. A node with only
// `initialWidth` / `initialHeight` uses them until it is measured, and `targetPosition` is the side
// of its edges' end while no handle gives one. A node's own `origin` places it by another point of
// its box than the root's `nodeOrigin` (here its top centre). Each node renders the handles it
// declares, and draws its frame inside its element, so a handle sits exactly on the node's side.
// The server draws the identity viewport (only the engine writes one), and `fitView` or a
// `defaultViewport` would move the whole flow once the engine is attached: none here, the nodes
// are placed to fit the frame at zoom 1.

interface Types extends FlowTypes {
    readonly nodes: { step: { label: string } };
}

const features = [selection(), drag()] as const;

const WIDTH = 150;
const HEIGHT = 56;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "request",
        type: "step",
        position: { x: 40, y: 40 },
        width: WIDTH,
        height: HEIGHT,
        handles: [
            { type: "source", position: "right", x: WIDTH, y: HEIGHT / 2 },
        ],
        data: { label: "Page request" },
    },
    {
        id: "render",
        type: "step",
        position: { x: 260, y: 40 },
        width: WIDTH,
        height: HEIGHT,
        handles: [
            { type: "target", position: "left", x: 0, y: HEIGHT / 2 },
            { type: "source", position: "right", x: WIDTH, y: HEIGHT / 2 },
        ],
        data: { label: "Server render" },
    },
    {
        id: "html",
        type: "step",
        position: { x: 480, y: 40 },
        width: WIDTH,
        height: HEIGHT,
        handles: [
            { type: "target", position: "left", x: 0, y: HEIGHT / 2 },
            { type: "source", position: "bottom", x: WIDTH / 2, y: HEIGHT },
        ],
        data: { label: "HTML with edges" },
    },
    {
        // placed by its top centre: right under the HTML node's bottom handle
        id: "hydrate",
        type: "step",
        position: { x: 480 + WIDTH / 2, y: 160 },
        origin: { x: 0.5, y: 0 },
        width: WIDTH,
        height: HEIGHT,
        handles: [
            { type: "target", position: "top", x: WIDTH / 2, y: 0 },
            { type: "source", position: "left", x: 0, y: HEIGHT / 2 },
        ],
        data: { label: "Hydrate" },
    },
    {
        // sized by its content once measured; until then by its initial size
        id: "measure",
        type: "step",
        position: { x: 260, y: 160 },
        initialWidth: WIDTH,
        initialHeight: HEIGHT,
        targetPosition: "right",
        data: { label: "Engine measures" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "request-render", source: "request", target: "render" },
    { id: "render-html", source: "render", target: "html" },
    { id: "html-hydrate", source: "html", target: "hydrate" },
    {
        id: "hydrate-measure",
        source: "hydrate",
        target: "measure",
        type: "smoothstep",
    },
];

/** Each node renders the handles it declares, or one on its `targetPosition` side. */
function renderNode(node: FlowNode<Types>) {
    return (
        <Flow.Node<Types> node={node} className={styles.node}>
            <div className={styles.card}>{node.data.label}</div>
            {node.handles?.map((declared) => (
                <Flow.Handle
                    key={declared.type}
                    type={declared.type}
                    side={declared.position}
                    className={styles.handle}
                />
            ))}
            {!node.handles && node.targetPosition && (
                <Flow.Handle
                    type="target"
                    side={node.targetPosition}
                    className={styles.handle}
                />
            )}
        </Flow.Node>
    );
}

export default function ServerRendering() {
    return (
        <Flow.Root<Types, typeof features>
            features={features}
            defaultNodes={nodes}
            defaultEdges={edges}
            className={styles.root}
        >
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
                <Flow.Nodes<Types>>{renderNode}</Flow.Nodes>
            </Flow.Viewport>
        </Flow.Root>
    );
}
