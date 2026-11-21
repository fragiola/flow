import {
    Flow,
    type FlowEdgeInput,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
    useEdges,
    useFlow,
    useNodes,
} from "@fragiola/flow-react";
import { connection } from "@fragiola/flow-react/connection";
import { drag } from "@fragiola/flow-react/drag";
import { selection } from "@fragiola/flow-react/selection";
import { styles } from "./styles";

// Each node type renders its own content from its typed data. The `Types` registry names the node
// types and their data, so `node.type` narrows `node.data`. The colour and number nodes write their
// data with `node.set-data`; the preview reads the nodes wired into its two target handles. A field
// inside a node keeps its own presses: it never starts a drag.

interface Types extends FlowTypes {
    readonly nodes: {
        colour: { label: string; colour: string };
        number: { label: string; value: number };
        preview: { label: string };
    };
}

type Node = FlowNode<Types>;

const features = [selection(), drag(), connection()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "colour",
        type: "colour",
        position: { x: 0, y: 0 },
        data: { label: "Colour", colour: "#3b82f6" },
    },
    {
        id: "size",
        type: "number",
        position: { x: 0, y: 160 },
        data: { label: "Size", value: 48 },
    },
    {
        id: "preview",
        type: "preview",
        position: { x: 320, y: 50 },
        data: { label: "Preview" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    {
        id: "colour-preview",
        source: "colour",
        target: "preview",
        targetHandle: "colour",
    },
    {
        id: "size-preview",
        source: "size",
        target: "preview",
        targetHandle: "size",
    },
];

function ColourNode({ node }: { node: Extract<Node, { type: "colour" }> }) {
    const { model } = useFlow<Types, typeof features>();
    return (
        <>
            <label className={styles.field}>
                <span className={styles.caption}>{node.data.label}</span>
                <input
                    type="color"
                    value={node.data.colour}
                    onChange={(event) =>
                        model.run("node.set-data", {
                            nodeId: node.id,
                            data: { colour: event.target.value },
                        })
                    }
                    className={styles.colourInput}
                />
            </label>
            <Flow.Handle type="source" side="right" className={styles.handle} />
        </>
    );
}

function NumberNode({ node }: { node: Extract<Node, { type: "number" }> }) {
    const { model } = useFlow<Types, typeof features>();
    return (
        <>
            <label className={styles.field}>
                <span className={styles.caption}>{node.data.label}</span>
                <input
                    type="range"
                    min={16}
                    max={96}
                    value={node.data.value}
                    onChange={(event) =>
                        model.run("node.set-data", {
                            nodeId: node.id,
                            data: { value: Number(event.target.value) },
                        })
                    }
                    className={styles.range}
                />
                <output className={styles.value}>{node.data.value}px</output>
            </label>
            <Flow.Handle type="source" side="right" className={styles.handle} />
        </>
    );
}

/** The value wired into one of the preview's handles: the source node's data, if any. */
function useInput(nodeId: string, handleId: string): Node | undefined {
    const edges = useEdges<Types>();
    const nodes = useNodes<Types>();
    const edge = edges.find(
        (e) => e.target === nodeId && e.targetHandle === handleId,
    );
    return nodes.find((n) => n.id === edge?.source);
}

function PreviewNode({ node }: { node: Extract<Node, { type: "preview" }> }) {
    const colour = useInput(node.id, "colour");
    const size = useInput(node.id, "size");
    const fill = colour?.type === "colour" ? colour.data.colour : undefined;
    const side = size?.type === "number" ? size.data.value : 32;
    return (
        <>
            <span className={styles.caption}>{node.data.label}</span>
            <div className={styles.stage}>
                {fill ? (
                    <div
                        role="img"
                        aria-label={`A ${side} pixel swatch of ${fill}`}
                        className={styles.swatch}
                        style={{ background: fill, width: side, height: side }}
                    />
                ) : (
                    <span className={styles.empty}>Connect a colour</span>
                )}
            </div>
            <Flow.Handle
                type="target"
                side="left"
                handleId="colour"
                className={styles.handle}
                style={{ top: "35%" }}
            />
            <Flow.Handle
                type="target"
                side="left"
                handleId="size"
                className={styles.handle}
                style={{ top: "75%" }}
            />
        </>
    );
}

/** One function for every node: stable, so a change re-renders only the node it touched. */
function renderNode(node: Node) {
    return (
        <Flow.Node<Types> node={node} className={styles.node}>
            {node.type === "colour" && <ColourNode node={node} />}
            {node.type === "number" && <NumberNode node={node} />}
            {node.type === "preview" && <PreviewNode node={node} />}
        </Flow.Node>
    );
}

export default function CustomNodes() {
    return (
        <Flow.Root<Types, typeof features>
            features={features}
            defaultNodes={nodes}
            defaultEdges={edges}
            fitView={{ padding: 0.2, maxZoom: 1 }}
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
                <Flow.ConnectionLine className={styles.connection} />
            </Flow.Viewport>
        </Flow.Root>
    );
}
