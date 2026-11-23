import {
    Flow,
    type FlowEdge,
    type FlowEdgeInput,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
    useFlow,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import { selection } from "@fragiola/flow-react/selection";
import {
    EraserIcon,
    LassoIcon,
    MousePointer2Icon,
    PencilIcon,
    SquareIcon,
} from "lucide-react";
import {
    createContext,
    type PointerEvent,
    useContext,
    useRef,
    useState,
} from "react";
import { type Segment, wiped } from "./eraser";
import { insideLasso } from "./lasso";
import {
    addPoint,
    type Bounds,
    boundsOf,
    type Point,
    pathOf,
    smooth,
    strokeOf,
} from "./stroke";
import { styles } from "./styles";

// A whiteboard: a toolbar of tools over the flow. "Select" is the flow as usual (pan, drag,
// select). Every other tool lays a drawing layer over the flow that takes the pointer
// (`data-flow-no-gesture`: the engine leaves its presses alone) and turns its client points into
// flow coordinates (`screen-to-flow`); the pane's pan is off meanwhile (`panOnDrag`). "Rectangle"
// adds a node of the dragged box; "Freehand" smooths the pointer's points into a path
// (`stroke.ts`) and saves it as a node of its own, placed at the stroke's top-left corner with the
// path relative to it; "Eraser" removes the nodes and edges the pointer wipes over (`eraser.ts`),
// in one `batch` per wipe; "Lasso" selects the nodes wholly inside the shape it draws
// (`lasso.ts`, `selection.set`). The active tool is on the root (`data-tool`).

interface Types extends FlowTypes {
    readonly nodes: {
        shape: { label: string };
        stroke: { label: string; d: string };
    };
}

const features = [selection(), drag(), keyboard()] as const;

type Tool = "select" | "rectangle" | "freehand" | "eraser" | "lasso";

const TOOLS = [
    { tool: "select", label: "Select", icon: MousePointer2Icon },
    { tool: "rectangle", label: "Rectangle", icon: SquareIcon },
    { tool: "freehand", label: "Freehand", icon: PencilIcon },
    { tool: "eraser", label: "Eraser", icon: EraserIcon },
    { tool: "lasso", label: "Lasso", icon: LassoIcon },
] as const satisfies readonly {
    tool: Tool;
    label: string;
    icon: unknown;
}[];

const HINTS: Record<Tool, string> = {
    select: "Drag the pane to pan, a node to move it.",
    rectangle: "Drag on the board to draw a rectangle.",
    freehand: "Draw with the pointer.",
    eraser: "Wipe over nodes and edges to erase them.",
    lasso: "Draw around nodes to select them.",
};

const shape = (
    id: string,
    label: string,
    x: number,
    y: number,
): FlowNodeInput<Types> => ({
    id,
    type: "shape",
    position: { x, y },
    width: 130,
    height: 70,
    data: { label },
});

const nodes: FlowNodeInput<Types>[] = [
    shape("ideas", "Ideas", 0, 0),
    shape("sketch", "Sketch", 240, 0),
    shape("review", "Review", 480, 0),
    shape("notes", "Notes", 120, 200),
    {
        id: "underline",
        type: "stroke",
        position: { x: 316, y: 216 },
        width: 168,
        height: 28,
        data: {
            label: "Squiggle",
            d: "M4,14 L30,6 L56,20 L82,6 L108,20 L134,6 L164,14",
        },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "ideas-sketch", source: "ideas", target: "sketch", type: "straight" },
    {
        id: "sketch-review",
        source: "sketch",
        target: "review",
        type: "straight",
    },
];

/** A drawn shape smaller than this (flow units) on either side is a slip, not a rectangle. */
const MIN_SIZE = 8;
/** How near (flow units) the eraser must pass to a node or an edge to wipe it. */
const REACH = 6;

const LABELS: Record<string, string> = Object.fromEntries(
    nodes.map((node) => [node.id, node.data.label]),
);

let count = 0;

/** The ids the eraser's current wipe has touched: marked until it ends, then removed. */
const Erasing = createContext<ReadonlySet<string>>(new Set());

function Shape({ node }: { node: FlowNode<Types> }) {
    const erasing = useContext(Erasing);
    const marked = erasing.has(node.id) ? "" : undefined;
    if (node.type === "stroke") {
        return (
            <Flow.Node<Types>
                node={node}
                role="group"
                aria-roledescription="stroke"
                aria-label={node.data.label}
                data-erasing={marked}
                className={styles.stroke}
            >
                <svg aria-hidden="true" className={styles.strokeSvg}>
                    <path d={node.data.d} className={styles.strokePath} />
                </svg>
            </Flow.Node>
        );
    }
    return (
        <Flow.Node<Types>
            node={node}
            role="group"
            aria-roledescription="rectangle"
            aria-label={node.data.label}
            data-erasing={marked}
            className={styles.shape}
        >
            {node.data.label}
            <Flow.Handle type="target" side="left" className={styles.handle} />
            <Flow.Handle type="source" side="right" className={styles.handle} />
        </Flow.Node>
    );
}

function Line({ edge }: { edge: FlowEdge<Types> }) {
    const erasing = useContext(Erasing);
    return (
        <Flow.Edge<Types>
            edge={edge}
            role="group"
            aria-roledescription="edge"
            aria-label={`${LABELS[edge.source]} to ${LABELS[edge.target]}`}
            data-erasing={erasing.has(edge.id) ? "" : undefined}
            className={styles.edgeGroup}
        >
            <Flow.EdgePath className={styles.edge} />
        </Flow.Edge>
    );
}

function renderNode(node: FlowNode<Types>) {
    return <Shape node={node} />;
}

function renderEdge(edge: FlowEdge<Types>) {
    return <Line edge={edge} />;
}

/** The tools, one pressed: a toolbar of toggle buttons. */
function Toolbar({
    tool,
    onTool,
    status,
}: {
    tool: Tool;
    onTool: (tool: Tool) => void;
    status: string;
}) {
    return (
        <div className={styles.panel}>
            <div
                role="toolbar"
                aria-label="Whiteboard tools"
                className={styles.tools}
            >
                {TOOLS.map(({ tool: each, label, icon: Icon }) => (
                    <button
                        key={each}
                        type="button"
                        aria-label={label}
                        aria-pressed={tool === each}
                        title={label}
                        onClick={() => onTool(each)}
                        className={styles.tool}
                    >
                        <Icon />
                    </button>
                ))}
            </div>
            <p className={styles.hint}>{HINTS[tool]}</p>
            <p role="status" className={styles.status}>
                {status}
            </p>
        </div>
    );
}

/**
 * The layer a drawing tool draws on, over the flow: it takes the pointer, shows what is being
 * drawn (in its own pixels) and, when the pointer is released, changes the flow through the model.
 */
function DrawingLayer({
    tool,
    onErasing,
    onStatus,
}: {
    tool: Exclude<Tool, "select">;
    onErasing: (ids: ReadonlySet<string>) => void;
    onStatus: (status: string) => void;
}) {
    const { model, engine } = useFlow<Types, typeof features>();
    // the pointer's client points, and the layer's corner when the press began
    const [points, setPoints] = useState<Point[]>([]);
    const corner = useRef<Point>({ x: 0, y: 0 });
    const wipe = useRef({
        nodeIds: new Set<string>(),
        edgeIds: new Set<string>(),
    });

    const toFlow = (point: Point) =>
        engine?.get("screen-to-flow", point) ?? point;

    /** The nodes' boxes, in flow coordinates. */
    const boxes = () =>
        model.get("all-nodes").flatMap((node) => {
            const box = engine?.get("node-rect-by", { nodeId: node.id });
            return box ? [{ id: node.id, box }] : [];
        });

    /** Marks what the run from `from` to `to` (client points) wipes. */
    function erase(from: Point, to: Point) {
        const lines = model.get("all-edges").flatMap((edge) => {
            const path = engine?.get("edge-path-by", { edgeId: edge.id });
            return path
                ? [{ id: edge.id, line: { a: path.source, b: path.target } }]
                : [];
        });
        const run: Segment = { a: toFlow(from), b: toFlow(to) };
        const hit = wiped(run, { nodes: boxes(), edges: lines }, REACH);
        if (hit.nodeIds.length === 0 && hit.edgeIds.length === 0) return;
        for (const id of hit.nodeIds) wipe.current.nodeIds.add(id);
        for (const id of hit.edgeIds) wipe.current.edgeIds.add(id);
        onErasing(new Set([...wipe.current.nodeIds, ...wipe.current.edgeIds]));
    }

    function onPointerDown(event: PointerEvent<HTMLDivElement>) {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        const box = event.currentTarget.getBoundingClientRect();
        corner.current = { x: box.x, y: box.y };
        const point = { x: event.clientX, y: event.clientY };
        wipe.current = { nodeIds: new Set(), edgeIds: new Set() };
        setPoints([point]);
        if (tool === "eraser") erase(point, point);
    }

    function onPointerMove(event: PointerEvent<HTMLDivElement>) {
        const last = points.at(-1);
        if (!last) return;
        const point = { x: event.clientX, y: event.clientY };
        if (tool === "rectangle") {
            setPoints([points[0] as Point, point]);
            return;
        }
        const next = addPoint(points, point, 2);
        if (next.length === points.length) return;
        if (tool === "eraser") erase(last, point);
        setPoints(next);
    }

    function finish() {
        if (points.length === 0) return;
        const flowPoints = points.map(toFlow);
        setPoints([]);
        if (tool === "rectangle") {
            const box = boundsOf(flowPoints);
            if (!box || box.width < MIN_SIZE || box.height < MIN_SIZE) return;
            count += 1;
            model.run("node.add", {
                id: `rectangle-${count}`,
                type: "shape",
                position: { x: box.x, y: box.y },
                width: Math.round(box.width),
                height: Math.round(box.height),
                data: { label: `Rectangle ${count}` },
            });
            onStatus(`Rectangle ${count} drawn.`);
        } else if (tool === "freehand") {
            const stroke = strokeOf(flowPoints, 4);
            if (!stroke) return;
            count += 1;
            model.run("node.add", {
                id: `stroke-${count}`,
                type: "stroke",
                position: stroke.position,
                width: Math.round(stroke.width),
                height: Math.round(stroke.height),
                data: { label: `Stroke ${count}`, d: stroke.d },
            });
            onStatus(`Stroke ${count} drawn.`);
        } else if (tool === "eraser") {
            const { nodeIds, edgeIds } = wipe.current;
            wipe.current = { nodeIds: new Set(), edgeIds: new Set() };
            onErasing(new Set());
            const removed = nodeIds.size + edgeIds.size;
            if (removed === 0) return;
            // the edges first: a removed node takes its other edges with it
            model.run("batch", {
                commands: [
                    ...[...edgeIds].map((edgeId) => ({
                        command: "edge.remove" as const,
                        payload: { edgeId },
                    })),
                    ...[...nodeIds].map((nodeId) => ({
                        command: "node.remove" as const,
                        payload: { nodeId },
                    })),
                ],
            });
            onStatus(`Erased ${removed} ${removed === 1 ? "item" : "items"}.`);
        } else {
            const nodeIds = insideLasso(boxes(), flowPoints);
            model.run("selection.set", { nodeIds, edgeIds: [] });
            onStatus(
                `${nodeIds.length} ${nodeIds.length === 1 ? "node" : "nodes"} selected.`,
            );
        }
    }

    function cancel() {
        setPoints([]);
        wipe.current = { nodeIds: new Set(), edgeIds: new Set() };
        onErasing(new Set());
    }

    // what is being drawn, in the layer's own pixels
    const local = points.map((point) => ({
        x: point.x - corner.current.x,
        y: point.y - corner.current.y,
    }));
    const box: Bounds | undefined =
        tool === "rectangle" ? boundsOf(local) : undefined;

    return (
        <div
            data-flow-no-gesture=""
            data-drawing={points.length > 0 ? "" : undefined}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={finish}
            onPointerCancel={cancel}
            className={styles.layer}
        >
            <svg aria-hidden="true" className={styles.preview}>
                {box && (
                    <rect
                        x={box.x}
                        y={box.y}
                        width={box.width}
                        height={box.height}
                        className={styles.previewRect}
                    />
                )}
                {tool === "freehand" && local.length > 1 && (
                    <path
                        d={pathOf(smooth(local))}
                        className={styles.previewStroke}
                    />
                )}
                {tool === "eraser" && local.length > 1 && (
                    <path d={pathOf(local)} className={styles.previewTrail} />
                )}
                {tool === "lasso" && local.length > 1 && (
                    <path
                        d={`${pathOf(local)} Z`}
                        className={styles.previewLasso}
                    />
                )}
            </svg>
        </div>
    );
}

export default function Whiteboard() {
    const [tool, setTool] = useState<Tool>("select");
    const [erasing, setErasing] = useState<ReadonlySet<string>>(new Set());
    const [status, setStatus] = useState("");

    return (
        <Erasing.Provider value={erasing}>
            <Flow.Root<Types, typeof features>
                features={features}
                defaultNodes={nodes}
                defaultEdges={edges}
                fitView={{ padding: 0.25, maxZoom: 1 }}
                // a drawing tool's press draws: the pane does not pan under it
                panOnDrag={tool === "select"}
                role="group"
                aria-label="Whiteboard"
                data-tool={tool}
                className={styles.root}
            >
                <Flow.Background
                    variant="dots"
                    size={2}
                    className={styles.dots}
                />
                <Flow.Background variant="lines" className={styles.lines} />
                <Flow.Background variant="cross" className={styles.cross} />
                <Flow.Viewport>
                    <Flow.Edges<Types>>{renderEdge}</Flow.Edges>
                    <Flow.Nodes<Types>>{renderNode}</Flow.Nodes>
                </Flow.Viewport>
                <Flow.SelectionBox className={styles.selectionBox} />
                {tool !== "select" && (
                    <DrawingLayer
                        tool={tool}
                        onErasing={setErasing}
                        onStatus={setStatus}
                    />
                )}
                <Toolbar tool={tool} onTool={setTool} status={status} />
            </Flow.Root>
        </Erasing.Provider>
    );
}
