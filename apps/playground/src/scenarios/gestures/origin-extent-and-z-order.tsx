import {
    Flow,
    type FlowEdgeInput,
    type FlowNodeInput,
    type XY,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import { MiniMap, minimap } from "@fragiola/flow-react/minimap";
import { selection } from "@fragiola/flow-react/selection";
import { subflows } from "@fragiola/flow-react/subflows";
import { useState } from "react";
import { FlowInspector } from "../../inspector/flow-inspector";

// The node origin, the extents and the z-order (#24). The origin moves every node's anchor: the
// dashed cross marks flow (0, 0), where node A stands. `nodeExtent` keeps every node inside the
// dotted rectangle; node B has its own `extent` rectangle too. The three cards overlap: a selected
// node rises above the others (`elevateNodesOnSelect`), a selected edge above the edges
// (`elevateEdgesOnSelect`), and C has `zIndex: 5` so it stays above A and B otherwise. Edges are
// never drawn above nodes (z-order is per layer). The fixture (fixtures/basic, `?origin=0.5`) is
// what Playwright drives.

const features = [
    selection(),
    drag(),
    keyboard(),
    subflows(),
    minimap(),
] as const;

const EXTENT = { x: -200, y: -150, width: 700, height: 450 };

const nodes: FlowNodeInput[] = [
    { id: "a", type: "card", position: { x: 0, y: 0 }, data: { label: "A" } },
    {
        id: "b",
        type: "card",
        position: { x: 60, y: 30 },
        extent: { x: 0, y: 0, width: 300, height: 200 },
        data: { label: "B, extent 300 × 200" },
    },
    {
        id: "c",
        type: "card",
        position: { x: 120, y: 60 },
        zIndex: 5,
        data: { label: "C, zIndex 5" },
    },
    {
        id: "d",
        type: "card",
        position: { x: 300, y: 220 },
        data: { label: "D" },
    },
];

const edges: FlowEdgeInput[] = [
    { id: "ad", source: "a", target: "d" },
    { id: "bd", source: "b", target: "d" },
];

const ORIGINS: Record<string, XY> = {
    "top left": { x: 0, y: 0 },
    centre: { x: 0.5, y: 0.5 },
    "bottom right": { x: 1, y: 1 },
};

export default function OriginExtentAndZOrder() {
    const [origin, setOrigin] = useState("top left");
    const [bounded, setBounded] = useState(true);
    const [elevateNodes, setElevateNodes] = useState(true);
    const [elevateEdges, setElevateEdges] = useState(false);
    const field = "flex items-center gap-1.5";
    return (
        <div className="flex size-full min-h-0 flex-col">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-palette-line px-3 py-2 text-sm">
                <label className={field}>
                    node origin
                    <select
                        value={origin}
                        onChange={(event) => setOrigin(event.target.value)}
                    >
                        {Object.keys(ORIGINS).map((name) => (
                            <option key={name}>{name}</option>
                        ))}
                    </select>
                </label>
                <label className={field}>
                    <input
                        type="checkbox"
                        checked={bounded}
                        onChange={(event) => setBounded(event.target.checked)}
                    />
                    node extent
                </label>
                <label className={field}>
                    <input
                        type="checkbox"
                        checked={elevateNodes}
                        onChange={(event) =>
                            setElevateNodes(event.target.checked)
                        }
                    />
                    elevate nodes on select
                </label>
                <label className={field}>
                    <input
                        type="checkbox"
                        checked={elevateEdges}
                        onChange={(event) =>
                            setElevateEdges(event.target.checked)
                        }
                    />
                    elevate edges on select
                </label>
            </div>
            <Flow.Root
                features={features}
                defaultNodes={nodes}
                defaultEdges={edges}
                defaultViewport={{ x: 260, y: 180, zoom: 1 }}
                nodeOrigin={ORIGINS[origin]}
                nodeExtent={bounded ? EXTENT : undefined}
                elevateNodesOnSelect={elevateNodes}
                elevateEdgesOnSelect={elevateEdges}
                className="min-h-0 flex-1 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size)"
            >
                <Flow.Background
                    variant="dots"
                    size={2}
                    className="text-(--fl-grid-color)"
                />
                <Flow.Viewport>
                    {/* flow coordinates: the extent's rectangle and the origin's cross */}
                    <div
                        className="pointer-events-none absolute border border-dotted border-palette-line"
                        style={{
                            left: EXTENT.x,
                            top: EXTENT.y,
                            width: EXTENT.width,
                            height: EXTENT.height,
                            display: bounded ? undefined : "none",
                        }}
                    />
                    <div className="pointer-events-none absolute -top-3 left-0 h-6 border-s border-dashed border-(--fl-edge-selected)" />
                    <div className="pointer-events-none absolute top-0 -left-3 w-6 border-t border-dashed border-(--fl-edge-selected)" />
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
                                className="palette-raised min-w-40 select-none rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) p-(--fl-node-padding) data-selected:border-(--fl-edge-selected)"
                            >
                                {String(item.data.label)}
                                <Flow.Handle type="target" side="top" />
                                <Flow.Handle type="source" side="bottom" />
                            </Flow.Node>
                        )}
                    </Flow.Nodes>
                </Flow.Viewport>
                <MiniMap
                    width={160}
                    height={110}
                    aria-label="Minimap"
                    className="absolute bottom-2 start-2 border border-palette-line bg-palette-base"
                />
                <FlowInspector />
            </Flow.Root>
        </div>
    );
}
