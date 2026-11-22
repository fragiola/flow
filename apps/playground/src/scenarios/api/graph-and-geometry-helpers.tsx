import {
    Flow,
    type FlowEdgeInput,
    type FlowNodeInput,
    useFlow,
    useNodes,
    useSelection,
    viewportForBounds,
} from "@fragiola/flow-react";
import { connection } from "@fragiola/flow-react/connection";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import { selection } from "@fragiola/flow-react/selection";
import { FlowInspector } from "../../inspector/flow-inspector";

// The graph and geometry helpers (#27): select a node and the panel lists its neighbours
// (`incomers-by`, `outgoers-by` on the model) and the nodes it overlaps (`intersecting-nodes` on
// the engine: drag "Sticky" over another node). "Frame the selection" animates to the viewport
// `viewport-for-bounds` gives for the selection's bounds; the export line is the pure
// `viewportForBounds` for a 1200 × 630 image of the whole flow. Every edge is a `simplebezier`.

const features = [selection(), drag(), connection(), keyboard()] as const;

const nodes: FlowNodeInput[] = [
    {
        id: "source",
        type: "step",
        position: { x: 0, y: 80 },
        data: { label: "Source" },
    },
    {
        id: "parse",
        type: "step",
        position: { x: 220, y: 0 },
        data: { label: "Parse" },
    },
    {
        id: "validate",
        type: "step",
        position: { x: 220, y: 160 },
        data: { label: "Validate" },
    },
    {
        id: "store",
        type: "step",
        position: { x: 440, y: 80 },
        data: { label: "Store" },
    },
    {
        id: "notify",
        type: "step",
        position: { x: 660, y: 80 },
        data: { label: "Notify" },
    },
    {
        id: "sticky",
        type: "note",
        position: { x: 440, y: 260 },
        data: { label: "Sticky" },
    },
];

const edges: FlowEdgeInput[] = [
    {
        id: "source-parse",
        source: "source",
        target: "parse",
        type: "simplebezier",
    },
    {
        id: "source-validate",
        source: "source",
        target: "validate",
        type: "simplebezier",
    },
    {
        id: "parse-store",
        source: "parse",
        target: "store",
        type: "simplebezier",
    },
    {
        id: "validate-store",
        source: "validate",
        target: "store",
        type: "simplebezier",
    },
    {
        id: "store-notify",
        source: "store",
        target: "notify",
        type: "simplebezier",
    },
];

const handle =
    "size-(--fl-handle-size) rounded-(--fl-handle-radius) border-(length:--fl-handle-border) border-(--fl-handle-line) bg-(--fl-handle-bg) data-valid:bg-(--fl-valid) data-invalid:bg-(--fl-invalid) focus-visible:outline-2 focus-visible:outline-(--fl-focus-line)";

/** The selected node's neighbours and overlaps, and the framing reads. */
function Helpers() {
    const { model, engine } = useFlow();
    const selected = useSelection();
    // re-render on every node change: the overlaps follow a drag
    useNodes();
    const node = selected.nodes.length === 1 ? selected.nodes[0] : undefined;
    const names = (list: readonly { data: Record<string, unknown> }[]) =>
        list.map((item) => String(item.data.label)).join(", ") || "none";
    const bounds = engine.get("nodes-bounds", {});
    const exported = bounds
        ? viewportForBounds(bounds, 1200, 630, { padding: 0.05 })
        : undefined;
    const frame = () => {
        const nodeIds = selected.nodes.map((item) => item.id);
        const area = engine.get("nodes-bounds", { nodeIds });
        if (!area) return;
        const viewport = engine.get("viewport-for-bounds", {
            bounds: area,
            padding: 0.3,
        });
        if (viewport)
            engine.run("set-viewport", { ...viewport, duration: 300 });
    };
    return (
        <div
            data-flow-no-gesture=""
            data-flow-no-wheel=""
            className="absolute top-3 left-3 grid gap-1 rounded border border-palette-line bg-palette-base p-2 text-xs"
        >
            <p>
                selected:{" "}
                <span data-testid="helper-selected">
                    {node ? String(node.data.label) : "one node, please"}
                </span>
            </p>
            {node && (
                <>
                    <p>
                        incomers:{" "}
                        <span data-testid="incomers">
                            {names(
                                model.get("incomers-by", { nodeId: node.id }),
                            )}
                        </span>
                    </p>
                    <p>
                        outgoers:{" "}
                        <span data-testid="outgoers">
                            {names(
                                model.get("outgoers-by", { nodeId: node.id }),
                            )}
                        </span>
                    </p>
                    <p>
                        overlaps:{" "}
                        <span data-testid="intersecting">
                            {names(
                                engine.get("intersecting-nodes", {
                                    nodeId: node.id,
                                }),
                            )}
                        </span>
                    </p>
                </>
            )}
            <button
                type="button"
                disabled={selected.nodes.length === 0}
                onClick={frame}
                className="rounded border border-palette-line px-2 py-1 disabled:opacity-50"
            >
                Frame the selection
            </button>
            <p>
                export 1200 × 630:{" "}
                <span data-testid="export-viewport">
                    {exported
                        ? `${exported.x.toFixed(0)}, ${exported.y.toFixed(0)} at ${exported.zoom.toFixed(2)}`
                        : "no size yet"}
                </span>
            </p>
        </div>
    );
}

export default function GraphAndGeometryHelpers() {
    return (
        <Flow.Root
            features={features}
            defaultNodes={nodes}
            defaultEdges={edges}
            fitView={{ padding: 0.2, maxZoom: 1 }}
            className="size-full min-h-0 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size)"
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
                            <Flow.EdgePath className="stroke-(--fl-edge-color) stroke-(length:--fl-edge-width) data-selected:stroke-(--fl-edge-selected)" />
                        </Flow.Edge>
                    )}
                </Flow.Edges>
                <Flow.Nodes>
                    {(item) => (
                        <Flow.Node
                            node={item}
                            aria-label={String(item.data.label)}
                            className="palette-raised min-w-32 select-none rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) p-(--fl-node-padding) data-selected:border-(--fl-edge-selected)"
                        >
                            {String(item.data.label)}
                            {item.type === "step" && (
                                <>
                                    <Flow.Handle
                                        type="target"
                                        side="left"
                                        className={handle}
                                    />
                                    <Flow.Handle
                                        type="source"
                                        side="right"
                                        className={handle}
                                    />
                                </>
                            )}
                        </Flow.Node>
                    )}
                </Flow.Nodes>
                <Flow.ConnectionLine className="stroke-(--fl-edge-selected)" />
            </Flow.Viewport>
            <Helpers />
            <FlowInspector />
        </Flow.Root>
    );
}
