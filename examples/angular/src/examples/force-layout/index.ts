import {
    Component,
    DestroyRef,
    effect,
    inject,
    signal,
    untracked,
} from "@angular/core";
import {
    createFlowModel,
    createFlowRef,
    FLOW,
    type FlowEdgeInput,
    type FlowEngineEventOf,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { drag } from "@fragiola/flow-angular/drag";
import { selection } from "@fragiola/flow-angular/selection";
import { LucideRotateCcw } from "@lucide/angular";
import { CentreEdge } from "./centre-edge";
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
import { ServiceNode } from "./service-node";
import { styles } from "./styles";

// A network laid out by a d3-force simulation (`forces.ts`): links pull the nodes they join
// together, every pair pushes apart, the boxes (their declared sizes) collide and the whole stays
// around the origin. On each of the simulation's ticks the nodes go to their new places in one
// transient `batch` of `node.move`; once it has cooled (`end`), one batch that is not transient
// keeps the places (one step for a history or a save), and the first time the view fits them.
// Dragging a node pins it: from `drag-start` (`(nodeDragStart)`) its body follows the node
// (`fx` / `fy`, read from the model on each tick, `engine.get("dragging-node-ids")`) and the
// simulation is reheated, so the others make room while it moves; the ticks never move a dragged
// node, or the drag and the simulation would fight. Dropped (`nodes-move`, `(nodesMove)`) it
// stays pinned where it is; a cancelled drag releases it. "Restart" releases every pin and heats
// the simulation up again. The root carries `data-simulation` ("running" or "settled"), each
// node `data-position` and, pinned, `data-pinned` (service-node.ts, given the pinned set's answer
// as an input); the edges run from centre to centre (centre-edge.ts). The simulation starts once
// the root has its engine (an `effect` over the flow ref) and stops when the example is left
// (`DestroyRef`).

export interface Types extends FlowTypes {
    readonly nodes: { service: { label: string } };
}

export const features = [selection(), drag()] as const;

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

export const labelOf = (id: string) => LABELS[id] ?? id;

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

/** The running simulation and its bodies by node id. */
interface Running {
    readonly simulation: ForceSimulation;
    readonly bodies: ReadonlyMap<string, ForceNode>;
}

@Component({
    selector: "example-force-layout",
    imports: [FLOW, CentreEdge, ServiceNode, LucideRotateCcw],
    host: { class: "contents" },
    template: `
        <div
            flowRoot
            [model]="model"
            [fitView]="fit"
            [flowRef]="flow"
            (nodeDragStart)="onNodeDragStart($event)"
            (nodesMove)="onNodesMove($event)"
            (nodeDragCancel)="onNodeDragCancel($event)"
            role="group"
            aria-label="Force layout"
            [attr.data-simulation]="status()"
            [class]="styles.root"
        >
            <svg flowBackground variant="dots" [size]="2" [class]="styles.dots"></svg>
            <svg flowBackground variant="lines" [class]="styles.lines"></svg>
            <svg flowBackground variant="cross" [class]="styles.cross"></svg>
            <div flowViewport>
                <div flowEdges>
                    <ng-template [flowEdgesItem]="model" let-edge>
                        <svg:g
                            [flowEdge]="edge"
                            exampleCentreEdge
                            role="group"
                            aria-roledescription="edge"
                            [class]="styles.edgeGroup"
                        ></svg:g>
                    </ng-template>
                </div>
                <div flowNodes>
                    <ng-template [flowNodesItem]="model" let-node>
                        <div
                            [flowNode]="node"
                            exampleServiceNode
                            [pinned]="pinned().has(node.id)"
                            role="group"
                            aria-roledescription="node"
                            [class]="styles.node"
                        ></div>
                    </ng-template>
                </div>
            </div>
            <div [class]="styles.panel">
                <span role="status" [class]="styles.status">
                    {{ status() === "running" ? "Simulating…" : "Settled" }}
                </span>
                <button type="button" (click)="restart()" [class]="styles.button">
                    <svg lucideRotateCcw aria-hidden="true"></svg>
                    Restart
                </button>
            </div>
        </div>
    `,
})
export default class ForceLayout {
    protected readonly styles = styles;
    protected readonly fit = FIT;
    protected readonly model = createFlowModel<Types, typeof features>(
        { version: 1, nodes, edges },
        { features },
    );
    protected readonly flow = createFlowRef<Types, typeof features>();
    protected readonly status = signal<Status>("running");
    /** The nodes pinned in the simulation: dragged, or dropped and not released yet. */
    protected readonly pinned = signal<ReadonlySet<string>>(new Set());
    private running: Running | undefined;
    /** whether the simulation was started */
    private started = false;

    constructor() {
        // the simulation, once the root is rendered (the flow ref holds its model and engine)
        effect(() => {
            if (this.started || !this.flow.current) return;
            this.started = true;
            untracked(() => this.start());
        });
        // leaving stops it
        inject(DestroyRef).onDestroy(() => {
            this.running?.simulation.stop();
            this.running = undefined;
        });
    }

    private start(): void {
        const current = this.flow.current;
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
            this.status.set("settled");
        });
        this.running = { simulation, bodies };
        simulation.restart();
    }

    /** Heats the simulation towards `target` and runs it (again). */
    private heat(target: number): void {
        if (!this.running) return;
        this.running.simulation.alphaTarget(target).restart();
        this.status.set("running");
    }

    /** Pins `nodeIds` where the model has them now. */
    private pinWhereTheyAre(nodeIds: readonly string[]): void {
        const model = this.flow.current?.model;
        if (!this.running || !model) return;
        for (const id of nodeIds) {
            const body = this.running.bodies.get(id);
            const node = model.get("node-by", { id });
            if (body && node) pinAt(body, node.position);
        }
        this.pinned.update((before) => new Set([...before, ...nodeIds]));
    }

    protected onNodeDragStart(event: FlowEngineEventOf<"drag-start">): void {
        this.pinWhereTheyAre(event.nodeIds);
        this.heat(DRAG_HEAT);
    }

    /** The drop: the nodes stay pinned where they are, and the simulation cools down. */
    protected onNodesMove(event: FlowEngineEventOf<"nodes-move">): void {
        if (event.source !== "pointer") return;
        this.pinWhereTheyAre(event.nodeIds);
        this.heat(0);
    }

    /** A cancelled drag: the nodes went back, and the forces move them again from there. */
    protected onNodeDragCancel(event: FlowEngineEventOf<"drag-cancel">): void {
        const model = this.flow.current?.model;
        if (!this.running || !model) return;
        for (const id of event.nodeIds) {
            const body = this.running.bodies.get(id);
            const node = model.get("node-by", { id });
            if (!body || !node) continue;
            pinAt(body, node.position);
            unpin(body);
        }
        this.pinned.update((before) => {
            const after = new Set(before);
            for (const id of event.nodeIds) after.delete(id);
            return after;
        });
        this.heat(0);
    }

    /** Releases every pin and heats the simulation up fully. */
    protected restart(): void {
        if (!this.running) return;
        for (const body of this.running.bodies.values()) unpin(body);
        this.pinned.set(new Set());
        this.running.simulation.alpha(1);
        this.heat(0);
    }
}
