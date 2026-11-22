import {
    type AnyTypes,
    Flow,
    type FlowEdgeInput,
    type FlowEngineEvent,
    type FlowNodeInput,
    useFlow,
    useSelection,
} from "@fragiola/flow-react";
import { connection } from "@fragiola/flow-react/connection";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import { NodeResizer, resize } from "@fragiola/flow-react/resize";
import { selection } from "@fragiola/flow-react/selection";
import { useEffect, useState } from "react";
import { FlowInspector } from "../../inspector/flow-inspector";

// Keyboard connections and resizing, and the toolbars (#27, #28). Tab to a handle and press Enter:
// Tab, Shift + Tab or the arrows point at another target, Enter connects, Escape cancels; the
// panel says what a screen reader would hear (`connect-start`, `connect-target`, `connect`,
// `connect-cancel`). Tab to a resize handle of "Resizable" and use the arrows (Shift for a bigger
// step). A selected edge shows its `Flow.EdgeToolbar`; two selected nodes or more show a
// `Flow.NodeToolbar` with `nodeIds` over the selection. The fixture (fixtures/basic,
// `?edgeToolbar=1`, `?nodeToolbar=1`, `?field=1`) is what Playwright drives.

const features = [
    selection(),
    drag(),
    connection(),
    resize({ minWidth: 120, minHeight: 60 }),
    keyboard(),
] as const;

const nodes: FlowNodeInput[] = [
    { id: "a", type: "card", position: { x: 0, y: 0 }, data: { label: "A" } },
    {
        id: "b",
        type: "card",
        position: { x: 280, y: -60 },
        data: { label: "B" },
    },
    {
        id: "c",
        type: "card",
        position: { x: 280, y: 100 },
        data: { label: "C" },
    },
    {
        id: "r",
        type: "resizable",
        position: { x: 0, y: 200 },
        width: 180,
        height: 90,
        data: { label: "Resizable" },
    },
];

const edges: FlowEdgeInput[] = [{ id: "ab", source: "a", target: "b" }];

const handle =
    "size-(--fl-handle-size) rounded-(--fl-handle-radius) border-(length:--fl-handle-border) border-(--fl-handle-line) bg-(--fl-handle-bg) data-valid:bg-(--fl-valid) data-invalid:bg-(--fl-invalid) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line)";
const toolbar =
    "flex gap-1 rounded border border-palette-line bg-palette-base p-1 text-xs shadow";
const button = "rounded border border-palette-line px-2 py-0.5";

/** What a live region would say, from the connection events. */
function say(event: FlowEngineEvent, name: (id: string) => string) {
    switch (event.type) {
        case "connect-start":
            return `Connecting from ${name(event.nodeId)} (${event.input}).`;
        case "connect-target":
            return event.index < 0
                ? "No handle accepts this connection."
                : `Target ${event.index + 1} of ${event.count}: ${name(event.nodeId ?? "")}.`;
        case "connect":
            return `Connected ${name(event.source)} to ${name(event.target)} (${event.input}).`;
        case "connect-cancel":
            return event.refused ? "Refused." : "Cancelled.";
        case "resize":
            return `${name(event.nodeId)} is ${event.width} × ${event.height} (${event.source}).`;
        default:
            return undefined;
    }
}

function Announcer() {
    const { model, engine } = useFlow();
    const [message, setMessage] = useState("Tab to a handle, then Enter.");
    useEffect(
        () =>
            engine.subscribe((event) => {
                const name = (id: string) =>
                    String(model.get("node-by", { id })?.data.label ?? id);
                const next = say(event, name);
                if (next) setMessage(next);
            }),
        [model, engine],
    );
    return (
        <p
            role="status"
            data-flow-no-gesture=""
            className="absolute top-3 left-3 rounded border border-palette-line bg-palette-base px-2 py-1 text-xs"
        >
            {message}
        </p>
    );
}

function SelectionToolbar() {
    const { model } = useFlow<AnyTypes, typeof features>();
    const selected = useSelection();
    if (selected.nodes.length < 2) return null;
    const nodeIds = selected.nodes.map((node) => node.id);
    const top = Math.min(...selected.nodes.map((node) => node.position.y));
    return (
        <Flow.NodeToolbar
            nodeIds={nodeIds}
            role="toolbar"
            aria-label="Selection"
            className={toolbar}
        >
            <span className="px-1">{nodeIds.length} nodes</span>
            <button
                type="button"
                className={button}
                onClick={() =>
                    model.run("batch", {
                        commands: selected.nodes.map((node) => ({
                            command: "node.move" as const,
                            payload: {
                                nodeId: node.id,
                                position: { x: node.position.x, y: top },
                            },
                        })),
                    })
                }
            >
                Align tops
            </button>
            <button
                type="button"
                className={button}
                onClick={() => model.run("selection.remove", {})}
            >
                Delete
            </button>
        </Flow.NodeToolbar>
    );
}

export default function KeyboardAndToolbars() {
    return (
        <Flow.Root
            features={features}
            defaultNodes={nodes}
            defaultEdges={edges}
            fitView={{ padding: 0.3, maxZoom: 1 }}
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
                        <Flow.Edge
                            edge={edge}
                            aria-label={`${edge.source} to ${edge.target}`}
                        >
                            <Flow.EdgePath className="stroke-(--fl-edge-color) stroke-(length:--fl-edge-width) data-selected:stroke-(--fl-edge-selected)" />
                            <EdgeActions edgeId={edge.id} />
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
                            <Flow.Handle
                                type="target"
                                side="left"
                                aria-label={`${String(item.data.label)} input`}
                                className={handle}
                            />
                            <Flow.Handle
                                type="source"
                                side="right"
                                aria-label={`${String(item.data.label)} output`}
                                className={handle}
                            />
                            {item.type === "resizable" && (
                                <NodeResizer className="[&>[data-flow-part=resize-handle]]:size-2.5 [&>[data-flow-part=resize-handle]]:bg-(--fl-edge-selected) [&>[data-flow-part=resize-handle]:focus-visible]:outline-2 [&>[data-flow-part=resize-handle]:focus-visible]:outline-(--fl-focus-line)" />
                            )}
                        </Flow.Node>
                    )}
                </Flow.Nodes>
                <Flow.ConnectionLine className="stroke-(--fl-edge-selected)" />
            </Flow.Viewport>
            <SelectionToolbar />
            <Announcer />
            <FlowInspector />
        </Flow.Root>
    );
}

function EdgeActions({ edgeId }: { edgeId: string }) {
    const { model } = useFlow();
    return (
        <Flow.EdgeToolbar
            role="toolbar"
            aria-label="Edge"
            offset={{ x: 0, y: -22 }}
            className={toolbar}
        >
            <button
                type="button"
                className={button}
                onClick={() => model.run("edge.remove", { edgeId })}
            >
                Remove
            </button>
        </Flow.EdgeToolbar>
    );
}
