import { Flow, type FlowEdge, type FlowNode } from "@fragiola/flow-react";
import { connection } from "@fragiola/flow-react/connection";
import { drag } from "@fragiola/flow-react/drag";
import { MiniMap, minimap } from "@fragiola/flow-react/minimap";
import { selection } from "@fragiola/flow-react/selection";
import { useEffect, useState } from "react";
import { FlowInspector } from "../../inspector/flow-inspector";

// 500 nodes and their edges, controlled (`nodes` / `edges` in React state, every change through
// `onNodesChange` / `onEdgesChange`): a drag step must re-render only the moved nodes and their
// edges. The counter shows how many node renders the app made (the children function counts
// them); e2e/scenarios.spec.ts drags a node and checks the count stays small. `onlyRenderVisible`
// renders only the nodes in view.

const COLUMNS = 25;
const ROWS = 20;

const initialNodes: FlowNode[] = Array.from(
    { length: COLUMNS * ROWS },
    (_, index) => ({
        id: `n${index}`,
        type: "cell",
        position: {
            x: (index % COLUMNS) * 140,
            y: Math.floor(index / COLUMNS) * 90,
        },
        data: { label: `${index}` },
    }),
);

const initialEdges: FlowEdge[] = initialNodes.flatMap((node, index) =>
    index % COLUMNS < COLUMNS - 1 && index % 3 === 0
        ? [{ id: `e${index}`, source: node.id, target: `n${index + 1}` }]
        : index + COLUMNS < initialNodes.length && index % 4 === 1
          ? [
                {
                    id: `e${index}`,
                    source: node.id,
                    target: `n${index + COLUMNS}`,
                },
            ]
          : [],
);

const features = [selection(), drag(), connection(), minimap()] as const;

/** How many times a node was rendered, since the scenario mounted. */
let renders = 0;

/** A stable children function (module scope): a new one would re-render every node. */
function renderNode(node: FlowNode) {
    renders += 1;
    return (
        <Flow.Node
            node={node}
            className="min-w-24 select-none rounded border border-palette-line bg-palette-base px-2 py-1 text-xs data-selected:border-(--fl-edge-selected)"
        >
            {String(node.data.label)}
            <Flow.Handle
                type="target"
                side="left"
                className="size-2 rounded-full bg-palette-accent"
            />
            <Flow.Handle
                type="source"
                side="right"
                className="size-2 rounded-full bg-palette-accent"
            />
        </Flow.Node>
    );
}

function renderEdge(edge: FlowEdge) {
    return (
        <Flow.Edge edge={edge}>
            <Flow.EdgePath className="stroke-(--fl-edge-color)" />
        </Flow.Edge>
    );
}

/** The render counter, read every frame. */
function Renders() {
    const [count, setCount] = useState(renders);
    useEffect(() => {
        let frame = requestAnimationFrame(function read() {
            setCount(renders);
            frame = requestAnimationFrame(read);
        });
        return () => cancelAnimationFrame(frame);
    }, []);
    return (
        <output data-testid="renders" aria-label="Node renders">
            {count}
        </output>
    );
}

export default function FiveHundredNodes() {
    const [nodes, setNodes] = useState<readonly FlowNode[]>(initialNodes);
    const [edges, setEdges] = useState<readonly FlowEdge[]>(initialEdges);
    const [visibleOnly, setVisibleOnly] = useState(false);
    useEffect(() => {
        renders = 0;
    }, []);
    return (
        <div className="flex size-full min-h-0 flex-col">
            <div className="flex items-center gap-4 border-b border-palette-line px-3 py-2 text-sm">
                <span>
                    {nodes.length} nodes, {edges.length} edges · renders:{" "}
                    <Renders />
                </span>
                <label className="flex items-center gap-1.5">
                    <input
                        type="checkbox"
                        checked={visibleOnly}
                        onChange={(event) =>
                            setVisibleOnly(event.target.checked)
                        }
                    />
                    only render visible
                </label>
                <button
                    type="button"
                    className="rounded border border-palette-line px-2"
                    onClick={() => {
                        renders = 0;
                    }}
                >
                    reset counter
                </button>
            </div>
            <Flow.Root
                features={features}
                nodes={nodes}
                edges={edges}
                onNodesChange={setNodes}
                onEdgesChange={setEdges}
                onlyRenderVisible={visibleOnly}
                fitView
                minZoom={0.1}
                className="min-h-0 flex-1 bg-(--fl-canvas-bg)"
            >
                <Flow.Background
                    variant="dots"
                    size={2}
                    className="text-(--fl-grid-color)"
                />
                <Flow.Viewport>
                    <Flow.Edges>{renderEdge}</Flow.Edges>
                    <Flow.Nodes>{renderNode}</Flow.Nodes>
                    <Flow.ConnectionLine className="stroke-(--fl-edge-selected)" />
                </Flow.Viewport>
                <MiniMap
                    width={160}
                    height={110}
                    aria-label="Minimap"
                    className="absolute bottom-2 start-2 border border-palette-line bg-palette-base"
                />
                <FlowInspector json={false} />
            </Flow.Root>
        </div>
    );
}
