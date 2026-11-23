import {
    Flow,
    type FlowEdgeInput,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
    useFlow,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { selection } from "@fragiola/flow-react/selection";
import { FileCodeIcon, ImageIcon } from "lucide-react";
import { type MouseEvent, useState } from "react";
import { downloadBlob, lookOf, pngOf, svgBlob } from "./download";
import { flowSvg } from "./flow-svg";
import { styles } from "./styles";

// An image of the flow, built from its document alone: `flowSvg` (flow-svg.ts) runs the core's
// static geometry (`staticGeometry`: node boxes from the declared sizes, edge paths from the path
// helpers) and writes a standalone SVG string, no DOM needed, so a server makes the same file (the
// unit test does, in node). Download SVG saves it; Download PNG draws it on a canvas and saves
// that. The file cannot read the page's CSS variables, so the theme's look is read off the drawn
// parts at click time and passed in as plain colours. The nodes declare their size and handles,
// so the document holds every box and edge end; drag them and export again.

interface Types extends FlowTypes {
    readonly nodes: { step: { label: string } };
}

const features = [selection(), drag()] as const;

const WIDTH = 140;
const HEIGHT = 48;

/** A node of the declared size, with an input on the left and an output on the right. */
function step(id: string, label: string, x: number, y: number) {
    return {
        id,
        type: "step",
        position: { x, y },
        width: WIDTH,
        height: HEIGHT,
        handles: [
            { type: "target", position: "left", x: 0, y: HEIGHT / 2 },
            { type: "source", position: "right", x: WIDTH, y: HEIGHT / 2 },
        ],
        data: { label },
    } satisfies FlowNodeInput<Types>;
}

const nodes: FlowNodeInput<Types>[] = [
    step("document", "Document", 0, 80),
    step("geometry", "Static geometry", 200, 0),
    step("paths", "Edge paths", 200, 160),
    step("svg", "SVG <string>", 400, 80),
    step("png", "PNG & canvas", 600, 80),
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "document-geometry", source: "document", target: "geometry" },
    {
        id: "document-paths",
        source: "document",
        target: "paths",
        type: "smoothstep",
    },
    { id: "geometry-svg", source: "geometry", target: "svg", type: "step" },
    { id: "paths-svg", source: "paths", target: "svg" },
    { id: "svg-png", source: "svg", target: "png", type: "straight" },
];

function renderNode(node: FlowNode<Types>) {
    return (
        <Flow.Node<Types>
            node={node}
            role="group"
            aria-roledescription="node"
            aria-label={node.data.label}
            className={styles.node}
        >
            <div data-frame="" className={styles.card}>
                {node.data.label}
            </div>
            <Flow.Handle type="target" side="left" className={styles.handle} />
            <Flow.Handle type="source" side="right" className={styles.handle} />
        </Flow.Node>
    );
}

function Toolbar() {
    const { model } = useFlow<Types, typeof features>();
    const [message, setMessage] = useState(
        "Drag the nodes, then download the flow.",
    );

    /** The SVG of the document as it is now, in the look of the page's theme. */
    function svgFrom(event: MouseEvent<HTMLButtonElement>) {
        const root = event.currentTarget.closest('[data-flow-part="root"]');
        const flow = model.get("flow-json");
        const svg = flowSvg(flow, { look: root ? lookOf(root) : {} });
        return {
            svg,
            counts: `${flow.nodes.length} nodes, ${flow.edges.length} edges`,
        };
    }

    function onSvg(event: MouseEvent<HTMLButtonElement>) {
        const { svg, counts } = svgFrom(event);
        downloadBlob(svgBlob(svg.markup), "flow.svg");
        setMessage(`Downloaded flow.svg (${counts}).`);
    }

    async function onPng(event: MouseEvent<HTMLButtonElement>) {
        const { svg, counts } = svgFrom(event);
        try {
            downloadBlob(await pngOf(svg), "flow.png");
            setMessage(`Downloaded flow.png (${counts}).`);
        } catch {
            setMessage("This browser could not draw the PNG.");
        }
    }

    return (
        <div
            role="toolbar"
            aria-label="Export"
            data-flow-no-gesture=""
            className={styles.panel}
        >
            <button type="button" onClick={onSvg} className={styles.primary}>
                <FileCodeIcon />
                Download SVG
            </button>
            <button type="button" onClick={onPng} className={styles.button}>
                <ImageIcon />
                Download PNG
            </button>
            <p role="status" data-testid="message" className={styles.message}>
                {message}
            </p>
        </div>
    );
}

export default function ExportImage() {
    return (
        <Flow.Root<Types, typeof features>
            features={features}
            defaultNodes={nodes}
            defaultEdges={edges}
            fitView
            role="group"
            aria-label="Export image"
            className={styles.root}
        >
            <Flow.Background variant="dots" size={2} className={styles.dots} />
            <Flow.Background variant="lines" className={styles.lines} />
            <Flow.Background variant="cross" className={styles.cross} />
            <Flow.Viewport>
                <Flow.Edges<Types>>
                    {(edge) => (
                        <Flow.Edge<Types>
                            edge={edge}
                            role="group"
                            aria-roledescription="edge"
                            aria-label={`${edge.source} to ${edge.target}`}
                        >
                            <Flow.EdgePath className={styles.edge} />
                        </Flow.Edge>
                    )}
                </Flow.Edges>
                <Flow.Nodes<Types>>{renderNode}</Flow.Nodes>
            </Flow.Viewport>
            <Toolbar />
        </Flow.Root>
    );
}
