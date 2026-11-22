import {
    Flow,
    type FlowEdgeInput,
    type FlowNodeInput,
} from "@fragiola/flow-react";
import { connection } from "@fragiola/flow-react/connection";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import { selection } from "@fragiola/flow-react/selection";
import { useState } from "react";
import { FlowInspector } from "../../inspector/flow-inspector";

// Click-to-connect, drag handles and the configurable keys (#24). With click-to-connect on, a tap
// on a handle starts a connection that follows the pointer; a tap on another handle draws the
// edge, a tap anywhere else or Escape cancels it (a drag from a handle still connects). The
// "Card" nodes drag only from their grip (a `data-flow-drag-handle` element): a press on the
// body selects them but moves nothing. The key fields set `selection({ multiKey, boxKey })` and
// `keyboard({ deleteKeys })`; the root is mounted again with the new features. The fixture
// (fixtures/basic, `?clickToConnect=1`, `?dragHandle=1`) is what Playwright drives.

const nodes: FlowNodeInput[] = [
    {
        id: "a",
        type: "card",
        position: { x: 0, y: 0 },
        data: { label: "Card A" },
    },
    {
        id: "b",
        type: "card",
        position: { x: 300, y: 0 },
        data: { label: "Card B" },
    },
    {
        id: "c",
        type: "box",
        position: { x: 0, y: 200 },
        data: { label: "Box C" },
    },
    {
        id: "d",
        type: "box",
        position: { x: 300, y: 200 },
        data: { label: "Box D" },
    },
];

const edges: FlowEdgeInput[] = [{ id: "ab", source: "a", target: "b" }];

const handle =
    "size-(--fl-handle-size) rounded-(--fl-handle-radius) border-(length:--fl-handle-border) border-(--fl-handle-line) bg-(--fl-handle-bg) data-valid:bg-(--fl-valid) data-invalid:bg-(--fl-invalid)";

/** A comma-separated list of keys, `none` for none. */
function keysOf(text: string): string[] | null {
    const keys = text
        .split(",")
        .map((key) => key.trim())
        .filter(Boolean);
    return keys.length === 0 || keys[0] === "none" ? null : keys;
}

export default function ClickToConnectAndDragHandles() {
    const [clickToConnect, setClickToConnect] = useState(true);
    const [multiKey, setMultiKey] = useState("Meta, Control, Shift");
    const [boxKey, setBoxKey] = useState("Shift");
    const [deleteKeys, setDeleteKeys] = useState("Delete, Backspace");
    const features = [
        selection({ multiKey: keysOf(multiKey), boxKey: keysOf(boxKey) }),
        drag(),
        connection({ clickToConnect }),
        keyboard({ deleteKeys: keysOf(deleteKeys) ?? [] }),
    ] as const;
    const field = "flex items-center gap-1.5";
    return (
        <div className="flex size-full min-h-0 flex-col">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-palette-line px-3 py-2 text-sm">
                <label className={field}>
                    <input
                        type="checkbox"
                        checked={clickToConnect}
                        onChange={(event) =>
                            setClickToConnect(event.target.checked)
                        }
                    />
                    click to connect
                </label>
                <label className={field}>
                    multi-select keys
                    <input
                        value={multiKey}
                        onChange={(event) => setMultiKey(event.target.value)}
                    />
                </label>
                <label className={field}>
                    box key
                    <input
                        value={boxKey}
                        onChange={(event) => setBoxKey(event.target.value)}
                    />
                </label>
                <label className={field}>
                    delete keys
                    <input
                        value={deleteKeys}
                        onChange={(event) => setDeleteKeys(event.target.value)}
                    />
                </label>
            </div>
            <Flow.Root
                key={[clickToConnect, multiKey, boxKey, deleteKeys].join("|")}
                features={features}
                defaultNodes={nodes}
                defaultEdges={edges}
                fitView={{ padding: 0.3, maxZoom: 1 }}
                className="min-h-0 flex-1 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size)"
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
                                {item.type === "card" && (
                                    <div
                                        data-flow-drag-handle=""
                                        className="mb-2 cursor-grab rounded bg-palette-soft px-2 py-1 text-xs active:cursor-grabbing"
                                    >
                                        grip
                                    </div>
                                )}
                                {String(item.data.label)}
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
                            </Flow.Node>
                        )}
                    </Flow.Nodes>
                    <Flow.ConnectionLine className="stroke-(--fl-edge-selected)" />
                </Flow.Viewport>
                <Flow.SelectionBox className="border border-(--fl-selection-line) bg-(--fl-selection-bg)" />
                <FlowInspector />
            </Flow.Root>
        </div>
    );
}
