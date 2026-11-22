import {
    type AnyTypes,
    Flow,
    type FlowEdgeInput,
    type FlowEngineEvent,
    type FlowNodeInput,
    useEdges,
    useFlowRef,
    useNodes,
    useViewport,
} from "@fragiola/flow-react";
import { connection } from "@fragiola/flow-react/connection";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import { MiniMap, minimap } from "@fragiola/flow-react/minimap";
import { reconnection } from "@fragiola/flow-react/reconnection";
import { NodeResizer, resize } from "@fragiola/flow-react/resize";
import { selection } from "@fragiola/flow-react/selection";
import { subflows } from "@fragiola/flow-react/subflows";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

// The unstyled flow Playwright drives (fixtures/basic): every feature, at a known viewport, so the
// specs reason in pixels. Its page's own few CSS lines give the parts a size and a look.
//
//   ?boxOnDrag=1   any drag on the canvas draws a selection box (`selection({ boxOnDrag })`): how a
//                  touch screen, which has no Shift, box-selects
//   ?snap=20       drags snap to a 20 px grid
//   ?clickToConnect=1   a tap on a handle starts a connection, a tap on another ends it
//   ?dragHandle=1  nodes a and b drag only from their `grip` (a `data-flow-drag-handle` element)
//   ?origin=0.5    every node's position is its box's centre (`nodeOrigin: { x: 0.5, y: 0.5 }`)
//   ?panOnDrag=0,1 the mouse buttons that pan the pane (here the primary and the middle one)
//   ?duration=300  the zoom and fit-view buttons animate for 300 ms
//
// `reconnection({ radius: 30 })`: a press on an edge's stroke within 30 px of an end moves that end,
// which is how a finger reconnects (a finger beside a handle lands on the handle).
//
// The root is 800 × 500 px at the page's top-left (the page has no margin), its viewport starts at
// { x: 100, y: 100, zoom: 1 }: a node at flow (x, y) is drawn at page (x + 100, y + 100).
//
//   a  (0, 0)      a source handle at the bottom (`a`), a target at the top
//   b  (300, 0)    the same; the edge ab joins a's source to b's target, with reconnect anchors
//   c  (0, 200)    160 × 80, a NodeResizer (min 80 × 40)
//   g  (300, 200)  a 240 × 160 group holding d (20, 60) with `extent: "parent"`
//
// Beside the root: the model's document (`json`), the viewport (`viewport`) and the engine's
// events (`events`), as JSON.

const params = new URLSearchParams(location.search);
const snap = Number(params.get("snap")) || undefined;
const dragHandle = params.get("dragHandle") === "1";
const origin = Number(params.get("origin")) || undefined;
const panOnDrag = params.get("panOnDrag")?.split(",").map(Number);
const duration = Number(params.get("duration")) || undefined;

const features = [
    selection({ boxOnDrag: params.get("boxOnDrag") === "1" }),
    drag(snap ? { snapGrid: [snap, snap] } : {}),
    connection({ clickToConnect: params.get("clickToConnect") === "1" }),
    reconnection({ radius: 30 }),
    resize({ minWidth: 80, minHeight: 40 }),
    subflows(),
    keyboard(),
    minimap(),
] as const;

const nodes: FlowNodeInput[] = [
    { id: "a", type: "box", position: { x: 0, y: 0 }, data: {} },
    { id: "b", type: "box", position: { x: 300, y: 0 }, data: {} },
    {
        id: "c",
        type: "box",
        position: { x: 0, y: 200 },
        width: 160,
        height: 80,
        data: {},
    },
    {
        id: "g",
        type: "group",
        position: { x: 300, y: 200 },
        width: 240,
        height: 160,
        data: {},
    },
    {
        id: "d",
        type: "box",
        parentId: "g",
        extent: "parent",
        position: { x: 20, y: 60 },
        data: {},
    },
];

const edges: FlowEdgeInput[] = [{ id: "ab", source: "a", target: "b" }];

function State() {
    const viewport = useViewport();
    const all = useNodes();
    const lines = useEdges();
    return (
        <>
            <pre data-testid="viewport" data-flow-no-gesture="">
                {JSON.stringify(viewport)}
            </pre>
            <pre data-testid="json" data-flow-no-gesture="">
                {JSON.stringify({ nodes: all, edges: lines })}
            </pre>
        </>
    );
}

function Fixture() {
    const flow = useFlowRef<AnyTypes, typeof features>();
    const [events, setEvents] = useState<FlowEngineEvent[]>([]);
    // the ref re-renders this component once the root attached its engine
    const engine = flow.current?.engine;
    useEffect(
        () =>
            engine?.subscribe((event) => {
                if (event.type !== "viewport-change") {
                    setEvents((list) => [...list, event]);
                }
            }),
        [engine],
    );
    return (
        <Flow.Root
            features={features}
            defaultNodes={nodes}
            defaultEdges={edges}
            defaultViewport={{ x: 100, y: 100, zoom: 1 }}
            nodeOrigin={origin ? { x: origin, y: origin } : undefined}
            panOnDrag={panOnDrag}
            flowRef={flow}
            data-testid="root"
        >
            <Flow.Background variant="dots" gap={20} size={2} />
            <Flow.Viewport>
                <Flow.Edges>
                    {(edge) => (
                        <Flow.Edge edge={edge} aria-label={`Edge ${edge.id}`}>
                            <Flow.EdgePath />
                            <Flow.ReconnectAnchor end="source" />
                            <Flow.ReconnectAnchor end="target" />
                        </Flow.Edge>
                    )}
                </Flow.Edges>
                <Flow.Nodes>
                    {(node) => (
                        <Flow.Node node={node} aria-label={`Node ${node.id}`}>
                            {node.id}
                            {dragHandle &&
                                (node.id === "a" || node.id === "b") && (
                                    <span data-flow-drag-handle="">grip</span>
                                )}
                            {node.type === "box" && (
                                <>
                                    <Flow.Handle type="target" side="top" />
                                    <Flow.Handle type="source" side="bottom" />
                                </>
                            )}
                            {node.id === "c" && <NodeResizer />}
                        </Flow.Node>
                    )}
                </Flow.Nodes>
                <Flow.ConnectionLine />
            </Flow.Viewport>
            <Flow.SelectionBox />
            <Flow.Controls>
                <Flow.ZoomIn duration={duration}>zoom in</Flow.ZoomIn>
                <Flow.ZoomOut duration={duration}>zoom out</Flow.ZoomOut>
                <Flow.FitView duration={duration}>fit view</Flow.FitView>
                <Flow.ToggleInteractive>lock</Flow.ToggleInteractive>
            </Flow.Controls>
            <MiniMap width={200} height={150} aria-label="Minimap" />
            <ol data-testid="events" data-flow-no-gesture="">
                {events.map((event, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: a log
                    <li key={index}>{JSON.stringify(event)}</li>
                ))}
            </ol>
            <State />
        </Flow.Root>
    );
}

export function mountFlowFixture() {
    const root = document.getElementById("root");
    if (!root) throw new Error("#root is missing");
    createRoot(root).render(
        <StrictMode>
            <Fixture />
        </StrictMode>,
    );
}
