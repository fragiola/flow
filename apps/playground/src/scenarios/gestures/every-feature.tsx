import {
    Flow,
    type FlowEdgeInput,
    type FlowNodeInput,
} from "@fragiola/flow-react";
import { connection } from "@fragiola/flow-react/connection";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import { MiniMap, minimap } from "@fragiola/flow-react/minimap";
import { reconnection } from "@fragiola/flow-react/reconnection";
import { NodeResizer, resize } from "@fragiola/flow-react/resize";
import { selection } from "@fragiola/flow-react/selection";
import { subflows } from "@fragiola/flow-react/subflows";
import { FlowInspector } from "../../inspector/flow-inspector";

// Every feature at once, themed, with the inspector beside it: try each gesture with a mouse, a
// trackpad, a pen or a finger and watch the engine's state and events. The unstyled twin that
// Playwright drives is fixtures/basic.

const features = [
    selection(),
    drag(),
    connection(),
    reconnection(),
    resize(),
    subflows(),
    keyboard(),
    minimap(),
] as const;

const nodes: FlowNodeInput[] = [
    { id: "a", type: "box", position: { x: 0, y: 0 }, data: { label: "A" } },
    { id: "b", type: "box", position: { x: 260, y: 0 }, data: { label: "B" } },
    {
        id: "c",
        type: "box",
        position: { x: 0, y: 180 },
        width: 160,
        height: 90,
        data: { label: "Resize me" },
    },
    {
        id: "g",
        type: "group",
        position: { x: 260, y: 160 },
        width: 260,
        height: 180,
        data: { label: "Group" },
    },
    {
        id: "d",
        type: "box",
        parentId: "g",
        extent: "parent",
        position: { x: 30, y: 60 },
        data: { label: "Child" },
    },
];

const edges: FlowEdgeInput[] = [{ id: "ab", source: "a", target: "b" }];

const node =
    "select-none rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) p-(--fl-node-padding) data-selected:border-(--fl-edge-selected)";
const handle =
    "size-(--fl-handle-size) rounded-(--fl-handle-radius) border-(length:--fl-handle-border) border-(--fl-handle-line) bg-(--fl-handle-bg) data-valid:bg-(--fl-valid) data-invalid:bg-(--fl-invalid)";

export default function EveryFeature() {
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
                        <Flow.Edge edge={edge} aria-label={`Edge ${edge.id}`}>
                            <Flow.EdgePath className="stroke-(--fl-edge-color) stroke-(length:--fl-edge-width) data-selected:stroke-(--fl-edge-selected)" />
                            <Flow.ReconnectAnchor end="source" />
                            <Flow.ReconnectAnchor end="target" />
                        </Flow.Edge>
                    )}
                </Flow.Edges>
                <Flow.Nodes>
                    {(item) => (
                        <Flow.Node
                            node={item}
                            aria-label={String(item.data.label)}
                            className={
                                item.type === "group"
                                    ? `${node} border-dashed bg-transparent`
                                    : `palette-raised ${node}`
                            }
                        >
                            {String(item.data.label)}
                            {item.type === "box" && (
                                <>
                                    <Flow.Handle
                                        type="target"
                                        side="top"
                                        className={handle}
                                    />
                                    <Flow.Handle
                                        type="source"
                                        side="bottom"
                                        className={handle}
                                    />
                                </>
                            )}
                            {item.id === "c" && (
                                <NodeResizer className="[&>*]:size-2 [&>*]:bg-(--fl-edge-selected)" />
                            )}
                        </Flow.Node>
                    )}
                </Flow.Nodes>
                <Flow.ConnectionLine className="stroke-(--fl-edge-selected)" />
            </Flow.Viewport>
            <Flow.SelectionBox className="border border-(--fl-selection-line) bg-(--fl-selection-bg)" />
            <Flow.Controls className="palette-raised absolute bottom-2 start-2 flex gap-1 rounded border border-palette-line bg-palette-base p-1 text-xs">
                <Flow.ZoomIn className="px-1.5 disabled:opacity-40">
                    zoom in
                </Flow.ZoomIn>
                <Flow.ZoomOut className="px-1.5 disabled:opacity-40">
                    zoom out
                </Flow.ZoomOut>
                <Flow.FitView className="px-1.5">fit</Flow.FitView>
                <Flow.ToggleInteractive className="px-1.5 aria-pressed:font-bold">
                    lock
                </Flow.ToggleInteractive>
            </Flow.Controls>
            <MiniMap
                width={160}
                height={110}
                aria-label="Minimap"
                className="absolute end-80 bottom-2 border border-palette-line bg-palette-base"
            />
            <FlowInspector />
        </Flow.Root>
    );
}
