import {
    type AnyTypes,
    Flow,
    type FlowEdgeInput,
    type FlowNodeInput,
    useFlow,
    useFlowStore,
    useInternalNode,
    useKeyPress,
    useNodeConnections,
    useNodeId,
    useNodesData,
    useOnViewportChange,
} from "@fragiola/flow-react";
import { connection } from "@fragiola/flow-react/connection";
import { drag } from "@fragiola/flow-react/drag";
import { selection } from "@fragiola/flow-react/selection";
import { useRef, useState } from "react";

// #36's hooks, each on screen: the sum node adds its incoming nodes' values (`useNodeConnections`
// + `useNodesData`), the panel shows the node count (`useFlowStore`), the sum's absolute box
// (`useInternalNode`), whether Shift is held (`useKeyPress`) and how many viewport moves ended
// (`useOnViewportChange`), and each piece counts its own renders.

const features = [selection(), drag(), connection()] as const;

const nodes: FlowNodeInput[] = [
    { id: "x", type: "value", position: { x: 0, y: 0 }, data: { value: 2 } },
    { id: "y", type: "value", position: { x: 0, y: 140 }, data: { value: 3 } },
    { id: "z", type: "value", position: { x: 0, y: 280 }, data: { value: 10 } },
    { id: "sum", type: "sum", position: { x: 260, y: 120 }, data: {} },
];

const edges: FlowEdgeInput[] = [
    { id: "x-sum", source: "x", target: "sum" },
    { id: "y-sum", source: "y", target: "sum" },
];

/** The sum node's body: the values of the nodes connected into it. */
function Sum() {
    const renders = useRef(0);
    renders.current += 1;
    const nodeId = useNodeId();
    const connections = useNodeConnections({ type: "target" });
    const data = useNodesData(
        connections.map((connection) => connection.source),
    );
    const total = data.reduce(
        (sum, entry) => sum + Number(entry.data.value ?? 0),
        0,
    );
    return (
        <span>
            {nodeId}: <span data-testid="sum-total">{total}</span> from{" "}
            <span data-testid="sum-sources">
                {data.map((entry) => entry.id).join(", ") || "none"}
            </span>{" "}
            (<span data-testid="sum-renders">{renders.current}</span> renders)
        </span>
    );
}

function Panel() {
    const { model } = useFlow<AnyTypes, typeof features>();
    const count = useFlowStore(({ model }) => model.get("all-nodes").length);
    const internal = useInternalNode("sum");
    const shift = useKeyPress("Shift");
    const [moves, setMoves] = useState(0);
    useOnViewportChange({ onEnd: () => setMoves((n) => n + 1) });
    const bump = (nodeId: string) => {
        const value = Number(
            model.get("node-by", { id: nodeId })?.data.value ?? 0,
        );
        model.run("node.set-data", { nodeId, data: { value: value + 1 } });
    };
    return (
        <div
            data-flow-no-gesture=""
            data-flow-no-wheel=""
            className="palette-raised absolute top-2 end-2 flex w-60 flex-col gap-1 rounded-md border border-palette-line bg-palette-base p-2 text-xs"
        >
            <div>
                nodes: <span data-testid="node-count">{count}</span>
            </div>
            <div>
                sum at:{" "}
                <span data-testid="sum-x">
                    {internal ? Math.round(internal.rect.x) : "?"}
                </span>
            </div>
            <div>
                Shift: <span data-testid="shift">{shift ? "held" : "up"}</span>
            </div>
            <div>
                moves ended: <span data-testid="moves">{moves}</span>
            </div>
            <button type="button" onClick={() => bump("x")}>
                x + 1
            </button>
            <button type="button" onClick={() => bump("z")}>
                z + 1
            </button>
            <button
                type="button"
                onClick={() =>
                    model.run("edge.add", {
                        id: "z-sum",
                        source: "z",
                        target: "sum",
                    })
                }
            >
                connect z
            </button>
        </div>
    );
}

export default function SelectingHooks() {
    return (
        <Flow.Root
            features={features}
            defaultNodes={nodes}
            defaultEdges={edges}
            defaultViewport={{ x: 80, y: 60, zoom: 1 }}
            className="size-full min-h-0 bg-(--fl-canvas-bg)"
        >
            <Flow.Background
                variant="dots"
                size={2}
                className="text-(--fl-grid-color)"
            />
            <Flow.Viewport>
                <Flow.Edges>
                    {(edge) => (
                        <Flow.Edge edge={edge}>
                            <Flow.EdgePath className="stroke-(--fl-edge-color) stroke-2" />
                        </Flow.Edge>
                    )}
                </Flow.Edges>
                <Flow.Nodes>
                    {(node) => (
                        <Flow.Node
                            node={node}
                            className="palette-raised min-w-16 select-none rounded border border-palette-line bg-palette-base px-3 py-2 data-selected:border-(--fl-edge-selected)"
                        >
                            {node.type === "sum" ? (
                                <Sum />
                            ) : (
                                `${node.id} = ${String(node.data.value)}`
                            )}
                            {node.type === "sum" ? (
                                <Flow.Handle type="target" side="left" />
                            ) : (
                                <Flow.Handle type="source" side="right" />
                            )}
                        </Flow.Node>
                    )}
                </Flow.Nodes>
            </Flow.Viewport>
            <Panel />
        </Flow.Root>
    );
}
