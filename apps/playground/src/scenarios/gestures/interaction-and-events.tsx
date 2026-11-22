import {
    Flow,
    type FlowEdgeInput,
    type FlowEngineEvent,
    type FlowNodeInput,
} from "@fragiola/flow-react";
import { connection } from "@fragiola/flow-react/connection";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import { reconnection } from "@fragiola/flow-react/reconnection";
import { selection } from "@fragiola/flow-react/selection";
import { useMemo, useState } from "react";
import { FlowInspector } from "../../inspector/flow-inspector";

// The interaction options and gesture events of #33 (Epic #34), each one a control above the
// flow: the tap distances, `preventScrolling`, `selectOnDrag`, the connection threshold and line
// type, the lock button; click, double-click, right-click and drag nodes, edges and the pane, and
// the log beside the flow shows every root callback (`onNodeClick`, `onMoveStart`, …) as it comes.
// Node `in` only receives connections (its source handle `connectableStart={false}`), node `out`
// only starts them, the edge `e2` moves its target end only. The fixture (fixtures/basic, with its
// `?selectOnDrag=0`, `?roles=1`, `?dropToAdd=1`, … queries) is what Playwright drives.

const nodes: FlowNodeInput[] = [
    { id: "out", type: "box", position: { x: 0, y: 0 }, data: {} },
    { id: "a", type: "box", position: { x: 260, y: 0 }, data: {} },
    { id: "b", type: "box", position: { x: 0, y: 180 }, data: {} },
    { id: "in", type: "box", position: { x: 260, y: 180 }, data: {} },
];

const edges: FlowEdgeInput[] = [
    { id: "e1", source: "out", target: "a" },
    { id: "e2", source: "b", target: "in", reconnectable: "target" },
];

const LINE_TYPES = [
    "bezier",
    "simplebezier",
    "smoothstep",
    "step",
    "straight",
] as const;

const field = "flex items-center gap-1.5";

/** An event as the log shows it: its type and its ids, without the DOM event. */
function line(event: FlowEngineEvent): string {
    const {
        type,
        event: _dom,
        ...rest
    } = event as FlowEngineEvent & {
        event?: unknown;
    };
    return `${type} ${JSON.stringify(rest)}`;
}

export default function InteractionAndEvents() {
    const [paneDistance, setPaneDistance] = useState(3);
    const [nodeDistance, setNodeDistance] = useState(3);
    const [preventScrolling, setPreventScrolling] = useState(true);
    const [selectOnDrag, setSelectOnDrag] = useState(true);
    const [threshold, setThreshold] = useState(1);
    const [lineType, setLineType] =
        useState<(typeof LINE_TYPES)[number]>("bezier");
    const [log, setLog] = useState<string[]>([]);
    // the features are read once: a new setting remounts the flow
    const features = useMemo(
        () =>
            [
                selection(),
                drag({ selectOnDrag }),
                connection({ threshold, lineType }),
                reconnection(),
                keyboard(),
            ] as const,
        [selectOnDrag, threshold, lineType],
    );
    const tell = (event: FlowEngineEvent) =>
        setLog((list) => [line(event), ...list].slice(0, 40));
    const menu = (event: FlowEngineEvent & { event: MouseEvent }) => {
        event.event.preventDefault();
        tell(event);
    };
    return (
        <div className="flex size-full min-h-0 flex-col">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-palette-line px-3 py-2 text-sm">
                <label className={field}>
                    pane click distance
                    <input
                        type="range"
                        min={0}
                        max={30}
                        value={paneDistance}
                        onChange={(event) =>
                            setPaneDistance(Number(event.target.value))
                        }
                    />
                    {paneDistance} px
                </label>
                <label className={field}>
                    node click distance
                    <input
                        type="range"
                        min={0}
                        max={30}
                        value={nodeDistance}
                        onChange={(event) =>
                            setNodeDistance(Number(event.target.value))
                        }
                    />
                    {nodeDistance} px
                </label>
                <label className={field}>
                    <input
                        type="checkbox"
                        checked={preventScrolling}
                        onChange={(event) =>
                            setPreventScrolling(event.target.checked)
                        }
                    />
                    prevent scrolling
                </label>
                <label className={field}>
                    <input
                        type="checkbox"
                        checked={selectOnDrag}
                        onChange={(event) =>
                            setSelectOnDrag(event.target.checked)
                        }
                    />
                    select on drag
                </label>
                <label className={field}>
                    connection threshold
                    <input
                        type="range"
                        min={1}
                        max={40}
                        value={threshold}
                        onChange={(event) =>
                            setThreshold(Number(event.target.value))
                        }
                    />
                    {threshold} px
                </label>
                <label className={field}>
                    line
                    <select
                        value={lineType}
                        onChange={(event) =>
                            setLineType(
                                event.target
                                    .value as (typeof LINE_TYPES)[number],
                            )
                        }
                    >
                        {LINE_TYPES.map((type) => (
                            <option key={type} value={type}>
                                {type}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <div className="flex min-h-0 flex-1">
                <Flow.Root
                    key={`${selectOnDrag}-${threshold}-${lineType}`}
                    features={features}
                    defaultNodes={nodes}
                    defaultEdges={edges}
                    fitView={{ padding: 0.3, maxZoom: 1 }}
                    paneClickDistance={paneDistance}
                    nodeClickDistance={nodeDistance}
                    preventScrolling={preventScrolling}
                    zoomOnScroll={preventScrolling}
                    onInit={tell}
                    onMoveStart={tell}
                    onMoveEnd={tell}
                    onNodeClick={tell}
                    onNodeDoubleClick={tell}
                    onNodeContextMenu={menu}
                    onEdgeClick={tell}
                    onEdgeDoubleClick={tell}
                    onEdgeContextMenu={menu}
                    onPaneClick={tell}
                    onPaneDoubleClick={tell}
                    onPaneContextMenu={menu}
                    onSelectionContextMenu={menu}
                    onSelectionStart={tell}
                    onSelectionEnd={tell}
                    onConnectCancel={tell}
                    onReconnectCancel={tell}
                    onDelete={tell}
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
                                    <Flow.ReconnectAnchor
                                        end="source"
                                        className="fill-(--fl-handle-bg)"
                                        r={5}
                                    />
                                    <Flow.ReconnectAnchor
                                        end="target"
                                        className="fill-(--fl-handle-bg)"
                                        r={5}
                                    />
                                </Flow.Edge>
                            )}
                        </Flow.Edges>
                        <Flow.Nodes>
                            {(item) => (
                                <Flow.Node
                                    node={item}
                                    aria-label={`Node ${item.id}`}
                                    className="palette-raised select-none rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) p-(--fl-node-padding) data-selected:border-(--fl-edge-selected)"
                                >
                                    {item.id}
                                    <Flow.Handle
                                        type="target"
                                        side="top"
                                        aria-label={`${item.id} input`}
                                        connectableEnd={item.id !== "out"}
                                        className="size-(--fl-handle-size) rounded-(--fl-handle-radius) bg-(--fl-handle-bg) not-data-connectable-end:opacity-30"
                                    />
                                    <Flow.Handle
                                        type="source"
                                        side="bottom"
                                        aria-label={`${item.id} output`}
                                        connectableStart={item.id !== "in"}
                                        className="size-(--fl-handle-size) rounded-(--fl-handle-radius) bg-(--fl-handle-bg) not-data-connectable-start:opacity-30"
                                    />
                                </Flow.Node>
                            )}
                        </Flow.Nodes>
                        <Flow.ConnectionLine className="stroke-(--fl-edge-selected)" />
                    </Flow.Viewport>
                    <Flow.SelectionBox className="border border-(--fl-selection-line) bg-(--fl-selection-bg)" />
                    <Flow.Controls className="palette-raised absolute bottom-2 start-2 flex gap-1 rounded border border-palette-line bg-palette-base p-1 text-xs">
                        <Flow.FitView className="px-1.5">fit</Flow.FitView>
                        <Flow.ToggleInteractive className="px-1.5 aria-pressed:font-bold">
                            lock
                        </Flow.ToggleInteractive>
                    </Flow.Controls>
                    <FlowInspector json={false} />
                </Flow.Root>
                <ol
                    data-testid="scenario-log"
                    className="w-80 overflow-auto border-s border-palette-line p-2 font-mono text-xs"
                >
                    {log.map((entry, index) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: a log
                        <li key={index}>{entry}</li>
                    ))}
                </ol>
            </div>
        </div>
    );
}
