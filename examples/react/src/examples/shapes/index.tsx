import {
    Flow,
    type FlowEdge,
    type FlowEdgeInput,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
    useFlow,
} from "@fragiola/flow-react";
import { connection } from "@fragiola/flow-react/connection";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import {
    NodeResizer,
    RESIZE_POSITIONS,
    ResizeHandle,
    resize,
} from "@fragiola/flow-react/resize";
import { selection } from "@fragiola/flow-react/selection";
import { PencilIcon } from "lucide-react";
import * as React from "react";
import { angleFrom, normalizeAngle, rotatedSide, type Side } from "./rotation";
import { SHAPE_NAMES, SHAPES, type Shape, shapePath } from "./shape-path";
import { styles } from "./styles";

// A flowchart: each node draws its shape as an SVG path sized to the node (`shape-path.ts`), and
// the selected node's toolbar picks another shape (`node.set-data`). The node is resized from its
// corners and sides (`NodeResizer`), and turned from the knob above it: the angle is the node's
// data, applied by the node's own `rotate()` on its content. Its handles turn with it, and each one
// takes the side it now faces (`rotation.ts`), so its edges leave the way it points; the handles
// are remounted on a turn (`key`), since a transform changes no size the engine would notice. The
// knob is a slider: drag it (Shift snaps to 15°) or use the arrows. Double-click a node
// (`onNodeDoubleClick`), or press its toolbar's pencil, to edit its label in place: Enter keeps
// it, Escape drops it.

interface Types extends FlowTypes {
    readonly nodes: { shape: { label: string; shape: Shape; angle: number } };
}

type Node = FlowNode<Types>;

const features = [
    selection(),
    drag(),
    connection(),
    resize({ minWidth: 60, minHeight: 40 }),
    keyboard(),
] as const;

/** A node of the chart: its id, place, size, shape and label. */
function chartNode(
    id: string,
    shape: Shape,
    label: string,
    x: number,
    y: number,
    width = 140,
    height = 64,
): FlowNodeInput<Types> {
    return {
        id,
        type: "shape",
        position: { x, y },
        width,
        height,
        data: { label, shape, angle: 0 },
    };
}

const nodes: FlowNodeInput<Types>[] = [
    chartNode("start", "circle", "Start", 130, 0, 140, 56),
    chartNode("read", "parallelogram", "Read order", 130, 110, 140, 56),
    {
        ...chartNode("check", "diamond", "In stock?", 130, 240, 140, 88),
        selected: true,
    },
    chartNode("reject", "rounded", "Notify buyer", 0, 400, 140, 56),
    chartNode("pick", "rectangle", "Pick items", 260, 400, 140, 56),
    chartNode("log", "cylinder", "Log reason", 0, 510, 140, 72),
    chartNode("ship", "hexagon", "Ship", 260, 510, 140, 56),
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "start-read", source: "start", target: "read" },
    { id: "read-check", source: "read", target: "check" },
    { id: "check-reject", source: "check", target: "reject" },
    { id: "check-pick", source: "check", target: "pick" },
    { id: "reject-log", source: "reject", target: "log" },
    { id: "pick-ship", source: "pick", target: "ship" },
];

/** Where a handle sits on the node's unturned content: the middle of its side. */
const PLACE: Record<Side, React.CSSProperties> = {
    top: { top: 0, left: "50%", transform: "translate(-50%, -50%)" },
    right: { top: "50%", left: "100%", transform: "translate(-50%, -50%)" },
    bottom: { top: "100%", left: "50%", transform: "translate(-50%, -50%)" },
    left: { top: "50%", left: 0, transform: "translate(-50%, -50%)" },
};

/** The knob's arrow step, and Shift's snap while dragging it (degrees). */
const STEP = 15;

/** The knob above the node: dragging it turns the node around its centre. */
function RotateHandle({
    node,
    frame,
}: {
    node: Node;
    frame: React.RefObject<HTMLDivElement | null>;
}) {
    const { model } = useFlow<Types, typeof features>();
    const turning = React.useRef(false);
    const rotate = (angle: number, transient: boolean) =>
        model.run(
            "node.set-data",
            { nodeId: node.id, data: { angle } },
            { transient },
        );
    const angleAt = (event: React.PointerEvent) => {
        const box = frame.current?.getBoundingClientRect();
        if (!box) return node.data.angle;
        // the content turns around its centre, which a turn does not move
        const center = {
            x: box.left + box.width / 2,
            y: box.top + box.height / 2,
        };
        return angleFrom(
            center,
            { x: event.clientX, y: event.clientY },
            event.shiftKey ? STEP : 1,
        );
    };
    return (
        <div
            role="slider"
            tabIndex={0}
            aria-label={`Rotate ${node.data.label}`}
            aria-valuemin={0}
            aria-valuemax={359}
            aria-valuenow={node.data.angle}
            aria-valuetext={`${node.data.angle} degrees`}
            data-flow-no-gesture=""
            onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                turning.current = true;
            }}
            onPointerMove={(event) => {
                if (turning.current) rotate(angleAt(event), true);
            }}
            onPointerUp={(event) => {
                if (!turning.current) return;
                turning.current = false;
                rotate(angleAt(event), false);
            }}
            onPointerCancel={() => {
                turning.current = false;
            }}
            onKeyDown={(event) => {
                const by =
                    event.key === "ArrowRight" || event.key === "ArrowUp"
                        ? STEP
                        : event.key === "ArrowLeft" || event.key === "ArrowDown"
                          ? -STEP
                          : undefined;
                if (event.key === "Home") rotate(0, false);
                else if (by !== undefined)
                    rotate(normalizeAngle(node.data.angle + by), false);
                else return;
                event.preventDefault();
            }}
            className={styles.rotate}
        />
    );
}

/** The label, or its field while it is edited in place. */
function Label({
    node,
    editing,
    setEditing,
}: {
    node: Node;
    editing: boolean;
    setEditing: (editing: boolean) => void;
}) {
    const { model } = useFlow<Types, typeof features>();
    // Escape drops the edit: the blur that follows must not keep it
    const dropped = React.useRef(false);
    // each edit starts undropped: the field may go without a blur, leaving the flag set
    React.useEffect(() => {
        if (editing) dropped.current = false;
    }, [editing]);
    if (!editing) {
        return <span className={styles.label}>{node.data.label}</span>;
    }
    const keep = (value: string) => {
        const label = value.trim();
        if (label !== "" && label !== node.data.label) {
            model.run("node.set-data", { nodeId: node.id, data: { label } });
        }
        setEditing(false);
    };
    return (
        <input
            aria-label={`Label of ${node.data.label}`}
            defaultValue={node.data.label}
            // biome-ignore lint/a11y/noAutofocus: the field opens on the user's request, to type in
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={(event) => {
                if (event.key === "Enter") keep(event.currentTarget.value);
                if (event.key === "Escape") {
                    dropped.current = true;
                    setEditing(false);
                }
            }}
            onBlur={(event) => {
                if (dropped.current) dropped.current = false;
                else keep(event.currentTarget.value);
            }}
            className={styles.field}
        />
    );
}

/** The selected node's toolbar: one button per shape, and the label's pencil. */
function ShapePicker({ node, onEdit }: { node: Node; onEdit: () => void }) {
    const { model } = useFlow<Types, typeof features>();
    return (
        <Flow.NodeToolbar
            side="right"
            role="toolbar"
            aria-label={`Shape of ${node.data.label}`}
            className={styles.toolbar}
        >
            {SHAPES.map((option) => (
                <button
                    key={option}
                    type="button"
                    aria-label={SHAPE_NAMES[option]}
                    aria-pressed={node.data.shape === option}
                    onClick={() =>
                        model.run("node.set-data", {
                            nodeId: node.id,
                            data: { shape: option },
                        })
                    }
                    className={styles.pick}
                >
                    <svg viewBox="0 0 22 16" aria-hidden="true">
                        <path d={shapePath(option, 22, 16, 1.5)} />
                    </svg>
                </button>
            ))}
            <button
                type="button"
                aria-label="Edit label"
                onClick={onEdit}
                className={styles.pick}
            >
                <PencilIcon />
            </button>
        </Flow.NodeToolbar>
    );
}

/** Which node's label is edited in place (one at a time), and how to change it. */
const Editing = React.createContext<{
    nodeId: string | undefined;
    edit: (nodeId: string | undefined) => void;
}>({ nodeId: undefined, edit: () => {} });

function ShapeNode({ node }: { node: Node }) {
    const frame = React.useRef<HTMLDivElement>(null);
    const { nodeId, edit } = React.useContext(Editing);
    const editing = nodeId === node.id;
    const setEditing = (on: boolean) => edit(on ? node.id : undefined);
    const { label, shape, angle } = node.data;
    const width = node.width ?? 140;
    const height = node.height ?? 64;
    return (
        <>
            <div
                ref={frame}
                data-shape={shape}
                data-angle={angle}
                style={{ transform: `rotate(${angle}deg)` }}
                className={styles.frame}
            >
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    aria-hidden="true"
                    className={styles.svg}
                >
                    <path
                        d={shapePath(shape, width, height, 1.5)}
                        className={styles.outline}
                    />
                </svg>
                <Label node={node} editing={editing} setEditing={setEditing} />
                <RotateHandle node={node} frame={frame} />
                {/* remounted on a turn: measured again where the turn put it */}
                <Flow.Handle
                    key={`in-${angle}`}
                    type="target"
                    side={rotatedSide("top", angle)}
                    aria-label={`${label} input`}
                    style={PLACE.top}
                    className={styles.handle}
                />
                <Flow.Handle
                    key={`out-${angle}`}
                    type="source"
                    side={rotatedSide("bottom", angle)}
                    aria-label={`${label} output`}
                    style={PLACE.bottom}
                    className={styles.handle}
                />
            </div>
            <NodeResizer className={styles.resizer}>
                {RESIZE_POSITIONS.map((position) => (
                    <ResizeHandle
                        key={position}
                        position={position}
                        aria-label={`Resize ${label}: ${position}`}
                        className={styles.resizeHandle}
                    />
                ))}
            </NodeResizer>
            <ShapePicker node={node} onEdit={() => setEditing(true)} />
        </>
    );
}

/** One function for every node: stable, so a change re-renders only the node it touched. */
function renderNode(node: Node) {
    return (
        <Flow.Node<Types>
            node={node}
            role="group"
            aria-roledescription="node"
            aria-label={`${node.data.label} (${SHAPE_NAMES[node.data.shape]})`}
            className={styles.node}
        >
            <ShapeNode node={node} />
        </Flow.Node>
    );
}

function renderEdge(edge: FlowEdge<Types>) {
    return (
        <Flow.Edge<Types>
            edge={edge}
            role="group"
            aria-roledescription="edge"
            aria-label={`${edge.source} to ${edge.target}`}
            className={styles.edgeGroup}
        >
            {/* a wide transparent path: a bigger target for a click */}
            <Flow.EdgePath className={styles.edgeHit} />
            <Flow.EdgePath className={styles.edge} />
        </Flow.Edge>
    );
}

export default function Shapes() {
    const [nodeId, edit] = React.useState<string | undefined>();
    const editing = React.useMemo(() => ({ nodeId, edit }), [nodeId]);
    return (
        <Editing.Provider value={editing}>
            <Flow.Root<Types, typeof features>
                features={features}
                defaultNodes={nodes}
                defaultEdges={edges}
                fitView={{ padding: 0.2, maxZoom: 1 }}
                role="group"
                aria-label="Order flowchart"
                onNodeDoubleClick={(event) => edit(event.nodeId)}
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
                    <Flow.ConnectionLine className={styles.connection} />
                </Flow.Viewport>
                <p className={styles.hint}>
                    Drag the knob to rotate (Shift snaps) · double-click a node
                    to edit its label
                </p>
            </Flow.Root>
        </Editing.Provider>
    );
}
