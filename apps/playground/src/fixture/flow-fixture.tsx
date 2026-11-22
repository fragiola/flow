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
//   ?edgeToolbar=1 the edge ab has a `Flow.EdgeToolbar` (shown while ab is selected) holding a
//                  `remove ab` button, 24 px above its label point
//   ?nodeToolbar=1 a `Flow.NodeToolbar` for a and b (`nodeIds`), shown while both are selected
//   ?edgeType=simplebezier  the edge ab's `type`
//   ?field=1       a text field (`Note`) beside the root, outside it
//
// Since #33 (the interaction options and gesture events of Epic #34):
//
//   ?selectOnDrag=0      dragging an unselected node does not select it (`drag({ selectOnDrag })`)
//   ?roles=1             a's target handle only starts connections (`connectableEnd={false}`), b's
//                        source handle only ends them (`connectableStart={false}`)
//   ?reconnectable=target  the edge ab moves its target end only (`reconnectable: "target"`)
//   ?dropToAdd=1         a connection dropped on the pane adds a node there, joined to its start
//                        (`onConnectCancel`'s `point`)
//   ?confirmDelete=1     the delete keys ask first (`keyboard({ beforeDelete })`, a promise): a
//                        `Delete?` panel with `Delete` and `Keep` buttons answers it
//   ?preventScrolling=0  the wheel the flow does not use scrolls the page
//   ?zoomOnScroll=0      the wheel does not zoom
//   ?threshold=10        a connection starts after 10 px (`connection({ threshold })`)
//   ?tall=1              the page is taller than the window (a scroll to measure)
//
// Since #36 (the component options and the selection rectangle of Epic #37):
//
//   ?inversePan=1        the minimap pans the other way (`MiniMap inversePan`); a tap on it logs
//                        its flow point in `minimap-clicks` (`onClick`), always
//   ?direction=horizontal  c's NodeResizer moves only its width (`direction`)
//   ?animated=1          the edge ab is `animated` (`data-animated` on its part)
//   ?nodesSelection=1    a `Flow.NodesSelection` around a box selection of two or more nodes; its
//                        drag's callbacks are logged in `gestures`
//
// The gesture callbacks of the root (`onNodeClick`, `onPaneClick`, the double clicks, the context
// menus, `onMoveStart` / `onMoveEnd`, `onSelectionStart`, `onResizeStart`, `onInit`, …) are logged,
// as JSON without their DOM event, in `gestures`; `events` keeps the engine's other events.
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
const edgeToolbar = params.get("edgeToolbar") === "1";
const nodeToolbar = params.get("nodeToolbar") === "1";
const edgeType = params.get("edgeType") ?? undefined;
const field = params.get("field") === "1";
const roles = params.get("roles") === "1";
const reconnectable = params.get("reconnectable");
const dropToAdd = params.get("dropToAdd") === "1";
const confirmDelete = params.get("confirmDelete") === "1";
const threshold = Number(params.get("threshold")) || undefined;
const tall = params.get("tall") === "1";
const inversePan = params.get("inversePan") === "1";
const direction =
    params.get("direction") === "horizontal" ||
    params.get("direction") === "vertical"
        ? (params.get("direction") as "horizontal" | "vertical")
        : undefined;
const animated = params.get("animated") === "1";
const nodesSelection = params.get("nodesSelection") === "1";

/** The answer of the `Delete?` panel (`?confirmDelete=1`), while one is asked for. */
let answerDelete: ((yes: boolean) => void) | undefined;
let showDelete: ((asked: string | null) => void) | undefined;

/** The engine events of #33, logged from the root's callbacks (`gestures`), not in `events`. */
const GESTURE_EVENTS = new Set([
    "viewport-change-start",
    "viewport-change-end",
    "ready",
    "node-click",
    "edge-click",
    "pane-click",
    "node-double-click",
    "edge-double-click",
    "pane-double-click",
    "node-context-menu",
    "edge-context-menu",
    "pane-context-menu",
    "selection-context-menu",
    "box-select-start",
    "resize-start",
    "resize-cancel",
    "selection-drag-start",
    "selection-drag-end",
    // carries the tapped minimap element, which JSON cannot write; `minimap-clicks` logs its point
    "minimap-click",
]);

const features = [
    selection({ boxOnDrag: params.get("boxOnDrag") === "1" }),
    drag({
        ...(snap ? { snapGrid: [snap, snap] as const } : {}),
        selectOnDrag: params.get("selectOnDrag") !== "0",
    }),
    connection({
        clickToConnect: params.get("clickToConnect") === "1",
        ...(threshold ? { threshold } : {}),
    }),
    reconnection({ radius: 30 }),
    resize({ minWidth: 80, minHeight: 40 }),
    subflows(),
    keyboard(
        confirmDelete
            ? {
                  beforeDelete: (asked) =>
                      new Promise<boolean>((resolve) => {
                          answerDelete = resolve;
                          showDelete?.(asked.map((n) => n.id).join(", "));
                      }),
              }
            : {},
    ),
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

const edges: FlowEdgeInput[] = [
    {
        id: "ab",
        source: "a",
        target: "b",
        ...(edgeType ? { type: edgeType } : {}),
        ...(animated ? { animated: true } : {}),
        ...(reconnectable === "source" || reconnectable === "target"
            ? { reconnectable }
            : {}),
    },
];

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
    const [gestures, setGestures] = useState<string[]>([]);
    const [asked, setAsked] = useState<string | null>(null);
    const [minimapClicks, setMinimapClicks] = useState<string[]>([]);
    showDelete = setAsked;
    /** Logs a gesture callback's event, without its DOM event. */
    const log = (event: FlowEngineEvent) => {
        const { event: _dom, ...rest } = event as FlowEngineEvent & {
            event?: unknown;
        };
        setGestures((list) => [...list, JSON.stringify(rest)]);
    };
    const callbacks = {
        onInit: log,
        onMoveStart: log,
        onMoveEnd: log,
        onNodeClick: log,
        onEdgeClick: log,
        onPaneClick: log,
        onNodeDoubleClick: log,
        onEdgeDoubleClick: log,
        onPaneDoubleClick: log,
        onNodeContextMenu: (event: FlowEngineEvent & { event?: Event }) => {
            event.event?.preventDefault();
            log(event);
        },
        onEdgeContextMenu: log,
        onPaneContextMenu: (event: FlowEngineEvent & { event?: Event }) => {
            event.event?.preventDefault();
            log(event);
        },
        onSelectionContextMenu: log,
        onSelectionStart: log,
        onResizeStart: log,
        onResizeCancel: log,
        onSelectionDragStart: log,
        onSelectionDragStop: log,
    };
    // the ref re-renders this component once the root attached its engine
    const engine = flow.current?.engine;
    useEffect(
        () =>
            engine?.subscribe((event) => {
                if (
                    event.type !== "viewport-change" &&
                    !GESTURE_EVENTS.has(event.type)
                ) {
                    setEvents((list) => [...list, event]);
                }
            }),
        [engine],
    );
    return (
        <>
            <Flow.Root
                features={features}
                defaultNodes={nodes}
                defaultEdges={edges}
                defaultViewport={{ x: 100, y: 100, zoom: 1 }}
                nodeOrigin={origin ? { x: origin, y: origin } : undefined}
                panOnDrag={panOnDrag}
                preventScrolling={params.get("preventScrolling") !== "0"}
                zoomOnScroll={params.get("zoomOnScroll") !== "0"}
                onConnectCancel={(event) => {
                    if (!dropToAdd || event.to) return;
                    const model = flow.current?.model;
                    const added = model?.run("node.add", {
                        type: "box",
                        position: event.point,
                        data: {},
                    });
                    if (!added?.ok) return;
                    const { nodeId } = added.value as { nodeId: string };
                    model?.run(
                        "edge.add",
                        event.from.type === "source"
                            ? { source: event.from.nodeId, target: nodeId }
                            : { source: nodeId, target: event.from.nodeId },
                    );
                }}
                {...callbacks}
                flowRef={flow}
                data-testid="root"
            >
                <Flow.Background variant="dots" gap={20} size={2} />
                <Flow.Viewport>
                    <Flow.Edges>
                        {(edge) => (
                            <Flow.Edge
                                edge={edge}
                                aria-label={`Edge ${edge.id}`}
                            >
                                <Flow.EdgePath />
                                <Flow.ReconnectAnchor end="source" />
                                <Flow.ReconnectAnchor end="target" />
                                {edgeToolbar && (
                                    <Flow.EdgeToolbar
                                        offset={{ x: 0, y: -24 }}
                                        aria-label={`Edge ${edge.id} toolbar`}
                                    >
                                        <button
                                            type="button"
                                            onClick={() =>
                                                flow.current?.model.run(
                                                    "edge.remove",
                                                    { edgeId: edge.id },
                                                )
                                            }
                                        >
                                            remove {edge.id}
                                        </button>
                                    </Flow.EdgeToolbar>
                                )}
                            </Flow.Edge>
                        )}
                    </Flow.Edges>
                    <Flow.Nodes>
                        {(node) => (
                            <Flow.Node
                                node={node}
                                aria-label={`Node ${node.id}`}
                            >
                                {node.id}
                                {dragHandle &&
                                    (node.id === "a" || node.id === "b") && (
                                        <span data-flow-drag-handle="">
                                            grip
                                        </span>
                                    )}
                                {node.type === "box" && (
                                    <>
                                        <Flow.Handle
                                            type="target"
                                            side="top"
                                            connectableEnd={
                                                roles && node.id === "a"
                                                    ? false
                                                    : undefined
                                            }
                                        />
                                        <Flow.Handle
                                            type="source"
                                            side="bottom"
                                            connectableStart={
                                                roles && node.id === "b"
                                                    ? false
                                                    : undefined
                                            }
                                        />
                                    </>
                                )}
                                {node.id === "c" && (
                                    <NodeResizer direction={direction} />
                                )}
                            </Flow.Node>
                        )}
                    </Flow.Nodes>
                    <Flow.ConnectionLine />
                    {nodesSelection && <Flow.NodesSelection />}
                </Flow.Viewport>
                {nodeToolbar && (
                    <Flow.NodeToolbar
                        nodeIds={["a", "b"]}
                        aria-label="a and b toolbar"
                    >
                        a and b
                    </Flow.NodeToolbar>
                )}
                <Flow.SelectionBox />
                <Flow.Controls>
                    <Flow.ZoomIn duration={duration}>zoom in</Flow.ZoomIn>
                    <Flow.ZoomOut duration={duration}>zoom out</Flow.ZoomOut>
                    <Flow.FitView duration={duration}>fit view</Flow.FitView>
                    <Flow.ToggleInteractive>lock</Flow.ToggleInteractive>
                </Flow.Controls>
                <MiniMap
                    width={200}
                    height={150}
                    aria-label="Minimap"
                    inversePan={inversePan || undefined}
                    onClick={(_event, point) =>
                        setMinimapClicks((list) => [
                            ...list,
                            JSON.stringify({
                                x: Math.round(point.x),
                                y: Math.round(point.y),
                            }),
                        ])
                    }
                />
                {asked !== null && (
                    <div
                        data-flow-part="panel"
                        data-testid="confirm-delete"
                        style={{ position: "absolute", right: 8, top: 8 }}
                    >
                        Delete {asked}?
                        <button
                            type="button"
                            onClick={() => {
                                setAsked(null);
                                answerDelete?.(true);
                            }}
                        >
                            Delete
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setAsked(null);
                                answerDelete?.(false);
                            }}
                        >
                            Keep
                        </button>
                    </div>
                )}
                <ol data-testid="gestures" data-flow-no-gesture="">
                    {gestures.map((line, index) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: a log
                        <li key={index}>{line}</li>
                    ))}
                </ol>
                <ol data-testid="minimap-clicks" data-flow-no-gesture="">
                    {minimapClicks.map((line, index) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: a log
                        <li key={index}>{line}</li>
                    ))}
                </ol>
                <ol data-testid="events" data-flow-no-gesture="">
                    {events.map((event, index) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: a log
                        <li key={index}>{JSON.stringify(event)}</li>
                    ))}
                </ol>
                <State />
            </Flow.Root>
            {field && <input aria-label="Note" data-testid="field" />}
            {tall && <div data-testid="spacer" style={{ height: 3000 }} />}
        </>
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
