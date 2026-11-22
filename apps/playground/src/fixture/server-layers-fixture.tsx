import {
    Flow,
    type FlowEdgeInput,
    type FlowNodeInput,
} from "@fragiola/flow-react";
import { selection } from "@fragiola/flow-react/selection";
import { renderToString } from "react-dom/server";

// The page e2e/server-html.spec.ts loads (#39): a flow whose nodes declare their size and handles,
// rendered to HTML by react-dom/server in the test process (through a Vite SSR server: the spec
// cannot import it, Playwright compiles JSX for its component testing, not React's).
//
// No engine writes the viewport's transform: flow (x, y) is page (x, y).
//
//   a  (100, 50)    120 × 60, its source handle at its bottom centre (160, 110)
//   b  (500, 290)   120 × 60, its target handle at its top centre (560, 290)
//   c  (300, 170)   120 × 60, its centre (360, 200) the straight edge ab's midpoint
//   e  (100, 350)   120 × 60, the straight edge ae vertical at x 160, from y 110 to 350
//
// ab is selected (zIndexMode "auto": a level of its own above c), ae is not (level 0).

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
    declared("a", 100, 50),
    declared("b", 500, 290),
    declared("c", 300, 170),
    declared("e", 100, 350),
];

const edges: FlowEdgeInput[] = [
    { id: "ab", source: "a", target: "b", type: "straight", selected: true },
    { id: "ae", source: "a", target: "e", type: "straight" },
];

const STYLE = `
    body { margin: 0; font: 13px/1.2 system-ui, sans-serif; }
    [data-flow-part="root"] { width: 800px; height: 500px; background: #f4f4f4; }
    [data-flow-part="node"] { box-sizing: border-box; padding: 10px; background: #fff; color: #111; box-shadow: 0 0 0 1px #333; }
    [data-flow-part="handle"] { width: 12px; height: 12px; border-radius: 50%; background: #333; }
    [data-flow-part="edge-path"] { stroke: #333; stroke-width: 6; }
`;

/** The page: the flow's server HTML, with the layers fixture's styles. */
export function serverHtml(): string {
    const flow = renderToString(
        <Flow.Root
            features={[selection()]}
            defaultNodes={nodes}
            defaultEdges={edges}
        >
            <Flow.Background />
            <Flow.Viewport>
                <Flow.Edges>
                    {(edge) => (
                        <Flow.Edge edge={edge}>
                            <Flow.EdgePath />
                        </Flow.Edge>
                    )}
                </Flow.Edges>
                <Flow.Nodes>
                    {(node) => (
                        <Flow.Node node={node}>
                            {node.id}
                            <Flow.Handle type="target" side="top" />
                            <Flow.Handle type="source" side="bottom" />
                        </Flow.Node>
                    )}
                </Flow.Nodes>
            </Flow.Viewport>
        </Flow.Root>,
    );
    return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><style>${STYLE}</style></head><body>${flow}</body></html>`;
}
