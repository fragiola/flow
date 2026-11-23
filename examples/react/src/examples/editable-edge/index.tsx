import {
    Flow,
    type FlowEdge,
    type FlowEdgeInput,
    type FlowEngineEventOf,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
    type Rect,
    useEdge,
    useFlow,
    useFlowRef,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import { selection } from "@fragiola/flow-react/selection";
import { RouteIcon, SplineIcon } from "lucide-react";
import { type KeyboardEvent, type PointerEvent, useState } from "react";
import {
    insertPoint,
    movePoint,
    type Point,
    pathThrough,
    removePoint,
} from "./control-points";
import { routeAround } from "./routing";
import { styles } from "./styles";

// An edge the user shapes. Its control points live in the edge's `data` (`points`, in flow
// coordinates) and change through the model (`edge.set-data`): the edge is drawn from its source
// end through them to its target end (`control-points.ts`), so they override any route. Drag a
// point to bend the edge (`screen-to-flow` turns the pointer into flow coordinates), double-click
// the edge to add one where you clicked (`onEdgeDoubleClick`), and press Delete on a focused
// point to remove it; the arrows move it. A point is a control of its own
// (`data-flow-no-gesture`): pressing it neither pans the pane nor drags a node. "Route" asks the
// grid search of `routing.ts` for an orthogonal way around every node's box (`node-rect-by`) and
// stores its corners as the points; "Clear points" straightens the edges.

interface Types extends FlowTypes {
    readonly nodes: { box: { label: string; obstacle: boolean } };
    readonly edges: { editable: { points: Point[] } };
}

const features = [selection(), drag(), keyboard()] as const;

const box = (
    id: string,
    label: string,
    x: number,
    y: number,
    width = 120,
    height = 44,
): FlowNodeInput<Types> => ({
    id,
    type: "box",
    position: { x, y },
    width,
    height,
    data: { label, obstacle: false },
});

const nodes: FlowNodeInput<Types>[] = [
    box("source", "Source", 0, 120),
    // in the way, and joined to nothing: no handle
    {
        ...box("firewall", "Firewall", 240, 40, 140, 200),
        data: { label: "Firewall", obstacle: true },
    },
    box("target", "Target", 520, 120),
    box("archive", "Archive", 520, 320),
];

const edges: FlowEdgeInput<Types>[] = [
    // straight through the firewall: "Route" takes it around
    {
        id: "source-target",
        source: "source",
        target: "target",
        type: "editable",
        data: { points: [] },
    },
    // already bent below it
    {
        id: "source-archive",
        source: "source",
        target: "archive",
        type: "editable",
        data: { points: [{ x: 180, y: 342 }] },
    },
];

const LABELS: Record<string, string> = Object.fromEntries(
    nodes.map((node) => [node.id, node.data.label]),
);

const nameOf = (edge: { source: string; target: string }) =>
    `${LABELS[edge.source]} to ${LABELS[edge.target]}`;

/** How far an arrow key moves a focused point (Shift: further). */
const STEP = 10;
const FAST_STEP = 50;

const ARROWS: Record<string, Point> = {
    ArrowUp: { x: 0, y: -1 },
    ArrowRight: { x: 1, y: 0 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
};

/** An edge of the app's `editable` type. */
type Editable = Extract<FlowEdge<Types>, { type?: "editable" }>;

/** The control points of an edge (none on an edge of another type). */
const pointsOf = (edge: FlowEdge<Types> | undefined): Point[] =>
    edge?.type === "editable" ? (edge.data?.points ?? []) : [];

function BendableEdge({ edge }: { edge: Editable }) {
    const { model, engine } = useFlow<Types, typeof features>();
    const { state } = useEdge<Types>(edge);
    const [dragging, setDragging] = useState<number | undefined>();
    if (!state.path) return null;
    const { source, target } = state.path;
    const points = pointsOf(edge);
    const name = nameOf(edge);
    const d = pathThrough([source, ...points, target], 8);

    const save = (next: Point[]) =>
        model.run("edge.set-data", {
            edgeId: edge.id,
            data: { points: next },
        });

    function onPointerDown(
        event: PointerEvent<SVGCircleElement>,
        index: number,
    ) {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(index);
    }

    function onPointerMove(
        event: PointerEvent<SVGCircleElement>,
        index: number,
    ) {
        if (dragging !== index) return;
        const point = engine?.get("screen-to-flow", {
            x: event.clientX,
            y: event.clientY,
        });
        if (point) save(movePoint(points, index, point));
    }

    function onKeyDown(event: KeyboardEvent<SVGCircleElement>, index: number) {
        const arrow = ARROWS[event.key];
        if (arrow) {
            event.preventDefault();
            const step = event.shiftKey ? FAST_STEP : STEP;
            const point = points[index] as Point;
            save(
                movePoint(points, index, {
                    x: point.x + arrow.x * step,
                    y: point.y + arrow.y * step,
                }),
            );
            return;
        }
        if (event.key !== "Delete" && event.key !== "Backspace") return;
        event.preventDefault();
        const group = event.currentTarget.closest('[data-flow-part="edge"]');
        save(removePoint(points, index));
        // focus stays on the edge: the point before, else the one now in its place, else the edge
        requestAnimationFrame(() => {
            const next =
                group?.querySelector<SVGElement>(
                    `[data-point="${index - 1}"]`,
                ) ??
                group?.querySelector<SVGElement>(`[data-point="${index}"]`) ??
                (group as SVGElement | null);
            next?.focus();
        });
    }

    return (
        <Flow.Edge<Types>
            edge={edge}
            role="group"
            aria-roledescription="edge"
            aria-label={name}
            data-points={points.length}
            className={styles.edgeGroup}
        >
            {/* a wide transparent path: a bigger target for a click and a double click */}
            <Flow.EdgePath d={d} className={styles.edgeHit} />
            <Flow.EdgePath d={d} className={styles.edge} />
            {points.map((point, index) => (
                // biome-ignore lint/a11y/useSemanticElements: SVG has no <button>: the circle is the control
                <circle
                    // a point's place is its identity: the list only grows and shrinks by the user
                    // biome-ignore lint/suspicious/noArrayIndexKey: see above
                    key={index}
                    cx={point.x}
                    cy={point.y}
                    r={7}
                    tabIndex={0}
                    role="button"
                    aria-roledescription="control point"
                    aria-label={`Control point ${index + 1} of ${name}`}
                    aria-keyshortcuts="ArrowUp ArrowRight ArrowDown ArrowLeft Delete Backspace"
                    data-flow-no-gesture=""
                    data-point={index}
                    data-dragging={dragging === index ? "" : undefined}
                    onPointerDown={(event) => onPointerDown(event, index)}
                    onPointerMove={(event) => onPointerMove(event, index)}
                    onLostPointerCapture={() => setDragging(undefined)}
                    onKeyDown={(event) => onKeyDown(event, index)}
                    className={styles.point}
                />
            ))}
        </Flow.Edge>
    );
}

function renderEdge(edge: FlowEdge<Types>) {
    if (edge.type !== "editable") return null;
    return <BendableEdge edge={edge} />;
}

function renderNode(node: FlowNode<Types>) {
    return (
        <Flow.Node<Types>
            node={node}
            role="group"
            aria-roledescription="node"
            aria-label={node.data.label}
            className={styles.node}
        >
            {node.data.label}
            {!node.data.obstacle && (
                <>
                    <Flow.Handle
                        type="target"
                        side="left"
                        className={styles.handle}
                    />
                    <Flow.Handle
                        type="source"
                        side="right"
                        className={styles.handle}
                    />
                </>
            )}
        </Flow.Node>
    );
}

/** The actions over every editable edge: route them around the nodes, or straighten them. */
function Actions() {
    const { model, engine } = useFlow<Types, typeof features>();
    const [status, setStatus] = useState("");

    function route() {
        if (!engine) return;
        const obstacles = model
            .get("all-nodes")
            .map((node) => engine.get("node-rect-by", { nodeId: node.id }))
            .filter((rect): rect is Rect => rect !== undefined);
        const stuck: string[] = [];
        const commands = model.get("all-edges").flatMap((edge) => {
            const path = engine.get("edge-path-by", { edgeId: edge.id });
            if (!path) return [];
            const found = routeAround(
                {
                    point: path.source,
                    side: path.sourceSide,
                    node: engine.get("node-rect-by", { nodeId: edge.source }),
                },
                {
                    point: path.target,
                    side: path.targetSide,
                    node: engine.get("node-rect-by", { nodeId: edge.target }),
                },
                obstacles,
            );
            if (!found.found) stuck.push(nameOf(edge));
            return [
                {
                    command: "edge.set-data" as const,
                    payload: {
                        edgeId: edge.id,
                        data: { points: found.points },
                    },
                },
            ];
        });
        model.run("batch", { commands });
        setStatus(
            stuck.length === 0
                ? "Routed around the nodes."
                : `No way around for ${stuck.join(", ")}: a plain step stands in.`,
        );
    }

    function clear() {
        model.run("batch", {
            commands: model.get("all-edges").map((edge) => ({
                command: "edge.set-data" as const,
                payload: { edgeId: edge.id, data: { points: [] } },
            })),
        });
        setStatus("The edges are straight.");
    }

    return (
        <div className={styles.panel}>
            <div
                role="toolbar"
                aria-label="Edge actions"
                className={styles.actions}
            >
                <button type="button" onClick={route} className={styles.action}>
                    <RouteIcon />
                    Route
                </button>
                <button type="button" onClick={clear} className={styles.action}>
                    <SplineIcon />
                    Clear points
                </button>
            </div>
            <p className={styles.hint}>
                Double-click an edge to add a point, drag a point to bend it,
                Delete removes it.
            </p>
            <p role="status" className={styles.status}>
                {status}
            </p>
        </div>
    );
}

export default function EditableEdge() {
    const flow = useFlowRef<Types, typeof features>();

    /** A double click on an edge: a point there, in the run nearest to it. */
    function onEdgeDoubleClick(event: FlowEngineEventOf<"edge-double-click">) {
        const current = flow.current;
        const edge = current?.model.get("edge-by", { id: event.edgeId });
        const path = current?.engine.get("edge-path-by", {
            edgeId: event.edgeId,
        });
        if (!current || !edge || !path) return;
        current.model.run("edge.set-data", {
            edgeId: edge.id,
            data: {
                points: insertPoint(
                    path.source,
                    path.target,
                    pointsOf(edge),
                    event.point,
                ),
            },
        });
    }

    return (
        <Flow.Root<Types, typeof features>
            features={features}
            defaultNodes={nodes}
            defaultEdges={edges}
            fitView={{ padding: 0.2, maxZoom: 1 }}
            flowRef={flow}
            onEdgeDoubleClick={onEdgeDoubleClick}
            role="group"
            aria-label="Editable edge"
            className={styles.root}
        >
            <Flow.Background variant="dots" size={2} className={styles.dots} />
            <Flow.Background variant="lines" className={styles.lines} />
            <Flow.Background variant="cross" className={styles.cross} />
            <Flow.Viewport>
                <Flow.Edges<Types>>{renderEdge}</Flow.Edges>
                <Flow.Nodes<Types>>{renderNode}</Flow.Nodes>
            </Flow.Viewport>
            <Actions />
        </Flow.Root>
    );
}
