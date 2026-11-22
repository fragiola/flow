import {
    Flow,
    type FlowEdgeInput,
    type FlowNodeInput,
    useEdges,
    type ZIndexMode,
} from "@fragiola/flow-react";
import { selection } from "@fragiola/flow-react/selection";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// The unstyled flow of fixtures/layers (#39): nodes that declare their size and handles, so their
// edge is drawn before anything is measured, a straight edge crossing a node, and a node placed by
// its own origin. The root is 800 × 500 px at the page's top-left, its viewport at
// { x: 100, y: 100, zoom: 1 }: a node at flow (x, y) is drawn at page (x + 100, y + 100).
//
//   a  (0, 0)      120 × 60, a declared source handle at its bottom centre (60, 60)
//   b  (400, 240)  120 × 60, a declared target handle at its top centre (460, 240)
//   c  (200, 120)  120 × 60, under the middle of the straight edge ab: the edge's midpoint
//                  (260, 150) is c's centre
//   d  (600, 40)   80 × 40, its own `origin: { x: 0.5, y: 0.5 }`: its box is (560, 20, 80, 40)
//
//   ?zIndexMode=basic|auto|manual  the root's `zIndexMode` (default: the engine's, "auto")
//   ?edgeZ=5       ab's `zIndex`
//   ?nodeZ=10      c's `zIndex`
//
// The edges' selection is printed beside the root (`edges`).

const params = new URLSearchParams(location.search);
const mode = params.get("zIndexMode");
const zIndexMode: ZIndexMode | undefined =
    mode === "basic" || mode === "auto" || mode === "manual" ? mode : undefined;
const edgeZ = Number(params.get("edgeZ")) || undefined;
const nodeZ = Number(params.get("nodeZ")) || undefined;

const features = [selection()] as const;

/** A 120 × 60 node with its two handles declared (12 × 12, centred on the top and bottom sides). */
function declared(id: string, x: number, y: number): FlowNodeInput {
    return {
        id,
        type: "box",
        position: { x, y },
        width: 120,
        height: 60,
        handles: [
            {
                type: "target",
                position: "top",
                x: 54,
                y: -6,
                width: 12,
                height: 12,
            },
            {
                type: "source",
                position: "bottom",
                x: 54,
                y: 54,
                width: 12,
                height: 12,
            },
        ],
        data: {},
    };
}

const nodes: FlowNodeInput[] = [
    declared("a", 0, 0),
    declared("b", 400, 240),
    { ...declared("c", 200, 120), ...(nodeZ ? { zIndex: nodeZ } : {}) },
    {
        id: "d",
        type: "box",
        position: { x: 600, y: 40 },
        width: 80,
        height: 40,
        origin: { x: 0.5, y: 0.5 },
        data: {},
    },
];

const edges: FlowEdgeInput[] = [
    {
        id: "ab",
        source: "a",
        target: "b",
        type: "straight",
        ...(edgeZ ? { zIndex: edgeZ } : {}),
    },
];

function State() {
    const lines = useEdges();
    return (
        <pre data-testid="edges" data-flow-no-gesture="">
            {JSON.stringify(lines)}
        </pre>
    );
}

function Fixture() {
    return (
        <Flow.Root
            features={features}
            defaultNodes={nodes}
            defaultEdges={edges}
            defaultViewport={{ x: 100, y: 100, zoom: 1 }}
            zIndexMode={zIndexMode}
            data-testid="root"
        >
            <Flow.Viewport>
                <Flow.Edges>
                    {(edge) => (
                        <Flow.Edge edge={edge} aria-label={`Edge ${edge.id}`}>
                            <Flow.EdgePath />
                        </Flow.Edge>
                    )}
                </Flow.Edges>
                <Flow.Nodes>
                    {(node) => (
                        <Flow.Node node={node} aria-label={`Node ${node.id}`}>
                            {node.id}
                            <Flow.Handle type="target" side="top" />
                            <Flow.Handle type="source" side="bottom" />
                        </Flow.Node>
                    )}
                </Flow.Nodes>
            </Flow.Viewport>
            <State />
        </Flow.Root>
    );
}

export function mountLayersFixture() {
    const root = document.getElementById("root");
    if (!root) throw new Error("#root is missing");
    createRoot(root).render(
        <StrictMode>
            <Fixture />
        </StrictMode>,
    );
}
