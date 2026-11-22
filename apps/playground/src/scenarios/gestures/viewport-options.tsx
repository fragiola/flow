import {
    Flow,
    type FlowEdgeInput,
    type FlowNodeInput,
    type PanOnScrollMode,
} from "@fragiola/flow-react";
import { connection } from "@fragiola/flow-react/connection";
import { drag } from "@fragiola/flow-react/drag";
import { MiniMap, minimap } from "@fragiola/flow-react/minimap";
import { resize } from "@fragiola/flow-react/resize";
import { selection } from "@fragiola/flow-react/selection";
import { useState } from "react";
import { FlowInspector } from "../../inspector/flow-inspector";

// The viewport's options (#23), each one a control above the flow: drag a node, a connection or a
// selection box (Shift + drag) to the edge to see auto-pan; pan with the mouse buttons ticked, or
// anywhere (nodes included) with the pan key held; scroll to pan with `panOnScroll`, on one axis
// with its mode, zoom with the zoom key held; the buttons animate for the duration chosen. The
// fixture (fixtures/basic, `?panOnDrag=0,1`, `?duration=300`) is what Playwright drives.

const features = [
    selection(),
    drag(),
    connection(),
    resize(),
    minimap(),
] as const;

const nodes: FlowNodeInput[] = Array.from({ length: 12 }, (_, index) => ({
    id: `n${index}`,
    type: "box",
    position: { x: (index % 4) * 220, y: Math.floor(index / 4) * 140 },
    data: { label: `Node ${index + 1}` },
}));

const edges: FlowEdgeInput[] = Array.from({ length: 11 }, (_, index) => ({
    id: `e${index}`,
    source: `n${index}`,
    target: `n${index + 1}`,
}));

/** Linear, for comparing with the default ease in and out. */
const linear = (t: number) => t;

const BUTTONS = [
    [0, "primary"],
    [1, "middle"],
    [2, "right"],
] as const;

const field = "flex items-center gap-1.5";

export default function ViewportOptions() {
    const [autoPan, setAutoPan] = useState(true);
    const [buttons, setButtons] = useState<number[]>([0]);
    const [panKey, setPanKey] = useState<string>(" ");
    const [panOnScroll, setPanOnScroll] = useState(false);
    const [mode, setMode] = useState<PanOnScrollMode>("free");
    const [speed, setSpeed] = useState(1);
    const [zoomKey, setZoomKey] = useState<string>("default");
    const [duration, setDuration] = useState(300);
    const [eased, setEased] = useState(true);
    return (
        <div className="flex size-full min-h-0 flex-col">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-palette-line px-3 py-2 text-sm">
                <label className={field}>
                    <input
                        type="checkbox"
                        checked={autoPan}
                        onChange={(event) => setAutoPan(event.target.checked)}
                    />
                    auto-pan
                </label>
                <span className={field}>
                    pan buttons
                    {BUTTONS.map(([button, name]) => (
                        <label key={button} className={field}>
                            <input
                                type="checkbox"
                                checked={buttons.includes(button)}
                                onChange={(event) =>
                                    setButtons((list) =>
                                        event.target.checked
                                            ? [...list, button]
                                            : list.filter((b) => b !== button),
                                    )
                                }
                            />
                            {name}
                        </label>
                    ))}
                </span>
                <label className={field}>
                    pan key
                    <select
                        value={panKey}
                        onChange={(event) => setPanKey(event.target.value)}
                    >
                        <option value=" ">Space</option>
                        <option value="Alt">Alt</option>
                        <option value="none">none</option>
                    </select>
                </label>
                <label className={field}>
                    <input
                        type="checkbox"
                        checked={panOnScroll}
                        onChange={(event) =>
                            setPanOnScroll(event.target.checked)
                        }
                    />
                    pan on scroll
                </label>
                <label className={field}>
                    mode
                    <select
                        value={mode}
                        onChange={(event) =>
                            setMode(event.target.value as PanOnScrollMode)
                        }
                    >
                        <option value="free">free</option>
                        <option value="horizontal">horizontal</option>
                        <option value="vertical">vertical</option>
                    </select>
                </label>
                <label className={field}>
                    speed
                    <input
                        type="range"
                        min={0.25}
                        max={3}
                        step={0.25}
                        value={speed}
                        onChange={(event) =>
                            setSpeed(Number(event.target.value))
                        }
                    />
                    {speed}
                </label>
                <label className={field}>
                    zoom key
                    <select
                        value={zoomKey}
                        onChange={(event) => setZoomKey(event.target.value)}
                    >
                        <option value="default">Meta / Control</option>
                        <option value="Shift">Shift</option>
                        <option value="none">none</option>
                    </select>
                </label>
                <label className={field}>
                    duration
                    <input
                        type="range"
                        min={0}
                        max={1000}
                        step={50}
                        value={duration}
                        onChange={(event) =>
                            setDuration(Number(event.target.value))
                        }
                    />
                    {duration} ms
                </label>
                <label className={field}>
                    <input
                        type="checkbox"
                        checked={eased}
                        onChange={(event) => setEased(event.target.checked)}
                    />
                    eased
                </label>
            </div>
            <Flow.Root
                features={features}
                defaultNodes={nodes}
                defaultEdges={edges}
                fitView={{ padding: 0.2, maxZoom: 1 }}
                autoPan={autoPan}
                panOnDrag={buttons}
                panActivationKey={panKey === "none" ? null : panKey}
                panOnScroll={panOnScroll}
                panOnScrollMode={mode}
                panOnScrollSpeed={speed}
                zoomActivationKey={
                    zoomKey === "default"
                        ? undefined
                        : zoomKey === "none"
                          ? null
                          : zoomKey
                }
                easing={eased ? undefined : linear}
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
                                className="palette-raised select-none rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) p-(--fl-node-padding) data-selected:border-(--fl-edge-selected)"
                            >
                                {String(item.data.label)}
                                <Flow.Handle
                                    type="target"
                                    side="top"
                                    className="size-(--fl-handle-size) rounded-(--fl-handle-radius) bg-(--fl-handle-bg)"
                                />
                                <Flow.Handle
                                    type="source"
                                    side="bottom"
                                    className="size-(--fl-handle-size) rounded-(--fl-handle-radius) bg-(--fl-handle-bg)"
                                />
                            </Flow.Node>
                        )}
                    </Flow.Nodes>
                    <Flow.ConnectionLine className="stroke-(--fl-edge-selected)" />
                </Flow.Viewport>
                <Flow.SelectionBox className="border border-(--fl-selection-line) bg-(--fl-selection-bg)" />
                <Flow.Controls className="palette-raised absolute bottom-2 start-2 flex gap-1 rounded border border-palette-line bg-palette-base p-1 text-xs">
                    <Flow.ZoomIn
                        duration={duration}
                        className="px-1.5 disabled:opacity-40"
                    >
                        zoom in
                    </Flow.ZoomIn>
                    <Flow.ZoomOut
                        duration={duration}
                        className="px-1.5 disabled:opacity-40"
                    >
                        zoom out
                    </Flow.ZoomOut>
                    <Flow.FitView duration={duration} className="px-1.5">
                        fit
                    </Flow.FitView>
                </Flow.Controls>
                <MiniMap
                    width={160}
                    height={110}
                    aria-label="Minimap"
                    className="absolute end-80 bottom-2 border border-palette-line bg-palette-base"
                />
                <FlowInspector json={false} />
            </Flow.Root>
        </div>
    );
}
