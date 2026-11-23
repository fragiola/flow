import {
    Flow,
    type FlowEdge,
    type FlowEdgeInput,
    type FlowEngineEventOf,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
    straightPath,
    useFlowRef,
    useInternalNode,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { selection } from "@fragiola/flow-react/selection";
import { PinIcon, RotateCcwIcon } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
    createSimulation,
    type ForceNode,
    type ForceSimulation,
    isPinned,
    movesOf,
    type Point,
    pinAt,
    toForceLinks,
    toForceNodes,
    unpin,
} from "./forces";
import { styles } from "./styles";

// A network laid out by a d3-force simulation (`forces.ts`): links pull the nodes they join
// together, every pair pushes apart, the boxes (their declared sizes) collide and the whole stays
// around the origin. On each of the simulation's ticks the nodes go to their new places in one
// transient `batch` of `node.move`; once it has cooled (`end`), one batch that is not transient
// keeps the places (one step for a history or a save), and the first time the view fits them.
// Dragging a node pins it: from `drag-start` its body follows the node (`fx` / `fy`, read from the
// model on each tick, `engine.get("dragging-node-ids")`) and the simulation is reheated, so the
// others make room while it moves; the ticks never move a dragged node, or the drag and the
// simulation would fight. Dropped (`nodes-move`) it stays pinned where it is; a cancelled drag
// releases it. "Restart" releases every pin and heats the simulation up again. The root carries
// `data-simulation` ("running" or "settled"), each node `data-position` and, pinned, `data-pinned`.

interface Types extends FlowTypes {
    readonly nodes: { service: { label: string } };
}

const features = [selection(), drag()] as const;

/** Every node's declared box, in flow units; the hubs are bigger. */
const WIDTH = 120;
const HEIGHT = 40;
const HUB_WIDTH = 140;
const HUB_HEIGHT = 48;

/** How the view fits the network: some room around it, never zoomed in past 1. */
const FIT = { padding: 0.15, maxZoom: 1 };

/** The simulation's heat while a node is dragged: the others keep moving around it. */
const DRAG_HEAT = 0.3;

type Status = "running" | "settled";

/**
 * The network: a small web service in three clusters (the clients, the core services and their
 * stores, the background jobs), joined through the Gateway and the Queue. Each node starts near
 * its cluster's corner; the simulation spreads them out.
 */
const SERVICES: readonly (readonly [
    id: string,
    label: string,
    hub: boolean,
    x: number,
    y: number,
])[] = [
    ["web", "Web app", false, -420, -160],
    ["mobile", "Mobile app", false, -420, 40],
    ["cdn", "CDN", false, -560, -60],
    ["gateway", "Gateway", true, -260, -60],
    ["api", "API", true, -40, -60],
    ["auth", "Auth", false, 40, -220],
    ["users", "Users", false, 160, -120],
    ["orders", "Orders", false, 40, 80],
    ["db", "Database", false, 260, -20],
    ["cache", "Cache", false, 280, -200],
    ["queue", "Queue", true, 120, 240],
    ["mailer", "Mailer", false, -40, 380],
    ["billing", "Billing", false, 260, 380],
    ["reports", "Reports", false, 360, 260],
];

const LINKS: readonly (readonly [source: string, target: string])[] = [
    ["web", "cdn"],
    ["mobile", "cdn"],
    ["web", "gateway"],
    ["mobile", "gateway"],
    ["gateway", "api"],
    ["api", "auth"],
    ["api", "users"],
    ["api", "orders"],
    ["auth", "users"],
    ["users", "db"],
    ["users", "cache"],
    ["orders", "db"],
    ["orders", "queue"],
    ["queue", "mailer"],
    ["queue", "billing"],
    ["queue", "reports"],
    ["billing", "reports"],
];

const LABELS: Record<string, string> = Object.fromEntries(
    SERVICES.map(([id, label]) => [id, label]),
);

const labelOf = (id: string) => LABELS[id] ?? id;

const nodes: FlowNodeInput<Types>[] = SERVICES.map(
    ([id, label, hub, x, y]) => ({
        id,
        type: "service",
        position: { x, y },
        width: hub ? HUB_WIDTH : WIDTH,
        height: hub ? HUB_HEIGHT : HEIGHT,
        data: { label },
    }),
);

const edges: FlowEdgeInput<Types>[] = LINKS.map(([source, target]) => ({
    id: `${source}-${target}`,
    source,
    target,
}));

/** What the simulation reads of a node: its id, place and declared size. */
const boxOf = (node: {
    id: string;
    position: Point;
    width?: number;
    height?: number;
}) => ({
    id: node.id,
    position: node.position,
    width: node.width ?? WIDTH,
    height: node.height ?? HEIGHT,
});

/** One `node.move` per payload, for a `batch`. */
const commandsOf = (moves: ReturnType<typeof movesOf>) =>
    moves.map((payload) => ({ command: "node.move" as const, payload }));

/** The nodes pinned in the simulation: dragged, or dropped and not released yet. */
const PinnedContext = createContext<ReadonlySet<string>>(new Set());

function ServiceNode({ node }: { node: FlowNode<Types> }) {
    const pinned = useContext(PinnedContext).has(node.id);
    return (
        <Flow.Node<Types>
            node={node}
            role="group"
            aria-roledescription="node"
            aria-label={node.data.label}
            data-position={`${Math.round(node.position.x)}, ${Math.round(node.position.y)}`}
            data-pinned={pinned ? "" : undefined}
            className={styles.node}
        >
            {node.data.label}
            {pinned && (
                <span className={styles.pin} aria-hidden="true">
                    <PinIcon />
                </span>
            )}
        </Flow.Node>
    );
}

/** An edge from centre to centre (no handles: a force layout has no sides), under the nodes. */
function CentreEdge({ edge }: { edge: FlowEdge<Types> }) {
    const source = useInternalNode<Types>(edge.source);
    const target = useInternalNode<Types>(edge.target);
    if (!source?.measured || !target?.measured) return null;
    const centre = (rect: {
        x: number;
        y: number;
        width: number;
        height: number;
    }) => ({
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
    });
    const { path } = straightPath({
        source: centre(source.rect),
        target: centre(target.rect),
    });
    return (
        <Flow.Edge<Types>
            edge={edge}
            role="group"
            aria-roledescription="edge"
            aria-label={`${labelOf(edge.source)} to ${labelOf(edge.target)}`}
            className={styles.edgeGroup}
        >
            <Flow.EdgePath d={path} className={styles.edge} />
        </Flow.Edge>
    );
}

/** The running simulation and its bodies by node id. */
interface Running {
    readonly simulation: ForceSimulation;
    readonly bodies: ReadonlyMap<string, ForceNode>;
}

export default function ForceLayout() {
    const flow = useFlowRef<Types, typeof features>();
    const running = useRef<Running | undefined>(undefined);
    const [status, setStatus] = useState<Status>("running");
    const [pinned, setPinned] = useState<ReadonlySet<string>>(new Set());

    useEffect(() => {
        const current = flow.current;
        if (!current) return;
        const { model, engine } = current;
        const list = toForceNodes(model.get("all-nodes").map(boxOf));
        const bodies = new Map(list.map((body) => [body.id, body]));
        const simulation = createSimulation(
            list,
            toForceLinks(model.get("all-edges")),
        );
        let fitted = false;
        simulation.on("tick", () => {
            // a dragged node leads: its body follows it, and the tick leaves it to the drag
            const dragging = new Set(engine.get("dragging-node-ids"));
            for (const id of dragging) {
                const body = bodies.get(id);
                const node = model.get("node-by", { id });
                if (body && node) pinAt(body, node.position);
            }
            const commands = commandsOf(
                movesOf(
                    list,
                    (body) => dragging.has(body.id) || isPinned(body),
                ),
            );
            if (commands.length === 0) return;
            // a step of the simulation: transient, as a drag's steps are
            model.run("batch", { commands }, { transient: true });
        });
        simulation.on("end", () => {
            // the places it settled on, once: the one change a history or a save keeps
            const commands = commandsOf(movesOf(list, isPinned));
            if (commands.length > 0) model.run("batch", { commands });
            if (!fitted && engine.is("ready")) {
                fitted = true;
                engine.run("fit-view", FIT);
            }
            setStatus("settled");
        });
        running.current = { simulation, bodies };
        simulation.restart();
        return () => {
            simulation.stop();
            running.current = undefined;
        };
    }, [flow]);

    /** Heats the simulation towards `target` and runs it (again). */
    function heat(target: number) {
        const current = running.current;
        if (!current) return;
        current.simulation.alphaTarget(target).restart();
        setStatus("running");
    }

    /** Pins `nodeIds` where the model has them now. */
    function pinWhereTheyAre(nodeIds: readonly string[]) {
        const current = running.current;
        const model = flow.current?.model;
        if (!current || !model) return;
        for (const id of nodeIds) {
            const body = current.bodies.get(id);
            const node = model.get("node-by", { id });
            if (body && node) pinAt(body, node.position);
        }
        setPinned((before) => new Set([...before, ...nodeIds]));
    }

    function onNodeDragStart(event: FlowEngineEventOf<"drag-start">) {
        pinWhereTheyAre(event.nodeIds);
        heat(DRAG_HEAT);
    }

    /** The drop: the nodes stay pinned where they are, and the simulation cools down. */
    function onNodesMove(event: FlowEngineEventOf<"nodes-move">) {
        if (event.source !== "pointer") return;
        pinWhereTheyAre(event.nodeIds);
        heat(0);
    }

    /** A cancelled drag: the nodes went back, and the forces move them again from there. */
    function onNodeDragCancel(event: FlowEngineEventOf<"drag-cancel">) {
        const current = running.current;
        const model = flow.current?.model;
        if (!current || !model) return;
        for (const id of event.nodeIds) {
            const body = current.bodies.get(id);
            const node = model.get("node-by", { id });
            if (!body || !node) continue;
            pinAt(body, node.position);
            unpin(body);
        }
        setPinned((before) => {
            const after = new Set(before);
            for (const id of event.nodeIds) after.delete(id);
            return after;
        });
        heat(0);
    }

    /** Releases every pin and heats the simulation up fully. */
    function restart() {
        const current = running.current;
        if (!current) return;
        for (const body of current.bodies.values()) unpin(body);
        setPinned(new Set());
        current.simulation.alpha(1);
        heat(0);
    }

    return (
        <PinnedContext.Provider value={pinned}>
            <Flow.Root<Types, typeof features>
                features={features}
                defaultNodes={nodes}
                defaultEdges={edges}
                fitView={FIT}
                flowRef={flow}
                onNodeDragStart={onNodeDragStart}
                onNodesMove={onNodesMove}
                onNodeDragCancel={onNodeDragCancel}
                role="group"
                aria-label="Force layout"
                data-simulation={status}
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
                    <Flow.Edges<Types>>
                        {(edge) => <CentreEdge edge={edge} />}
                    </Flow.Edges>
                    <Flow.Nodes<Types>>
                        {(node) => <ServiceNode node={node} />}
                    </Flow.Nodes>
                </Flow.Viewport>
                <div className={styles.panel}>
                    <span role="status" className={styles.status}>
                        {status === "running" ? "Simulating…" : "Settled"}
                    </span>
                    <button
                        type="button"
                        onClick={restart}
                        className={styles.button}
                    >
                        <RotateCcwIcon aria-hidden="true" />
                        Restart
                    </button>
                </div>
            </Flow.Root>
        </PinnedContext.Provider>
    );
}
