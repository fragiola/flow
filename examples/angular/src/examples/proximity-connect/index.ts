import { Component, signal } from "@angular/core";
import {
    createFlowModel,
    createFlowRef,
    FLOW,
    type FlowEngine,
    type FlowEngineEventOf,
    type FlowJson,
    type FlowModel,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { drag } from "@fragiola/flow-angular/drag";
import { keyboard } from "@fragiola/flow-angular/keyboard";
import { selection } from "@fragiola/flow-angular/selection";
import { type Link, type Placed, proximityLink } from "./proximity";
import { styles } from "./styles";
import { TemporaryEdge } from "./temporary-edge";

// Connecting by proximity: drag a node near another and a dashed line shows the edge it would
// make, to the closest node within `MAX_GAP` (flow units between the two boxes) that it is not
// joined to yet; drop it there and the edge is added. The dashed line is the example's own state,
// never the document's: `drag-start` (`(nodeDragStart)`) says which node is dragged, a store
// (`injectFlowStore`, temporary-edge.ts) reads every node's box (`engine.get("node-rect-by")`)
// while it moves and keeps the closest one, and the drop (`nodes-move`, `(nodesMove)`) runs
// `edge.add` when there is one. The geometry is framework-free, in `proximity.ts`.

export interface Types extends FlowTypes {
    readonly nodes: { step: { label: string } };
}

export const features = [selection(), drag(), keyboard()] as const;

/** How close (flow units of empty space between two nodes) a drop must be to connect. */
const MAX_GAP = 80;

const step = (id: string, label: string, x: number, y: number) => ({
    id,
    type: "step" as const,
    position: { x, y },
    width: 140,
    height: 56,
    data: { label },
});

const json: FlowJson<Types> = {
    version: 1,
    nodes: [
        step("fetch", "Fetch", 0, 0),
        step("parse", "Parse", 320, 0),
        step("store", "Store", 640, 0),
        step("notify", "Notify", 160, 280),
        step("log", "Log", 480, 280),
    ],
    edges: [{ id: "fetch-parse", source: "fetch", target: "parse" }],
};

/** The node's labels, for the edges' names. */
const LABELS: Record<string, string> = Object.fromEntries(
    json.nodes.map((node) => [node.id, node.data.label]),
);

/** The edge a dragged node would make now, from every node's box on screen, or none. */
export function linkFor(
    model: FlowModel<Types, typeof features>,
    engine: FlowEngine<Types, typeof features>,
    nodeId: string,
): Link | undefined {
    const placed: Placed[] = [];
    for (const node of model.get("all-nodes")) {
        const box = engine.get("node-rect-by", { nodeId: node.id });
        if (box && box.width > 0) placed.push({ id: node.id, box });
    }
    const dragged = placed.find((item) => item.id === nodeId);
    if (!dragged) return undefined;
    return proximityLink(dragged, placed, model.get("all-edges"), MAX_GAP);
}

@Component({
    selector: "example-proximity-connect",
    imports: [FLOW, TemporaryEdge],
    host: { class: "contents" },
    template: `
        <div
            flowRoot
            [model]="model"
            [fitView]="{ padding: 0.2, maxZoom: 1 }"
            [flowRef]="flow"
            (nodeDragStart)="onNodeDragStart($event)"
            (nodesMove)="onNodesMove($event)"
            (nodeDragCancel)="dragged.set(undefined)"
            role="group"
            aria-label="Proximity connect"
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
                            role="group"
                            aria-roledescription="edge"
                            [attr.aria-label]="label(edge.source) + ' to ' + label(edge.target)"
                            [class]="styles.edgeGroup"
                        >
                            <svg:path flowEdgePath [class]="styles.edge" />
                        </svg:g>
                    </ng-template>
                </div>
                @if (dragged(); as nodeId) {
                    <example-temporary-edge [nodeId]="nodeId" />
                }
                <div flowNodes>
                    <ng-template [flowNodesItem]="model" let-node>
                        <div
                            [flowNode]="node"
                            role="group"
                            aria-roledescription="node"
                            [attr.aria-label]="node.data.label"
                            [class]="styles.node"
                        >
                            <div flowHandle type="target" side="left" [class]="styles.handle"></div>
                            {{ node.data.label }}
                            <div flowHandle type="source" side="right" [class]="styles.handle"></div>
                        </div>
                    </ng-template>
                </div>
            </div>
            <p [class]="styles.hint">Drag a node close to another one and drop it to connect them</p>
        </div>
    `,
})
export default class ProximityConnect {
    protected readonly styles = styles;
    protected readonly model = createFlowModel<Types, typeof features>(json, {
        features,
    });
    protected readonly flow = createFlowRef<Types, typeof features>();
    /** the node being dragged alone, while it is: app state, never the document's */
    protected readonly dragged = signal<string | undefined>(undefined);

    protected label(id: string): string {
        return LABELS[id] ?? id;
    }

    protected onNodeDragStart(event: FlowEngineEventOf<"drag-start">): void {
        this.dragged.set(
            event.nodeIds.length === 1 ? event.nodeIds[0] : undefined,
        );
    }

    /** The drop: the edge the temporary line showed, if any, becomes a real one. */
    protected onNodesMove(event: FlowEngineEventOf<"nodes-move">): void {
        const nodeId = this.dragged();
        this.dragged.set(undefined);
        const current = this.flow.current;
        if (!current || event.source !== "pointer" || nodeId === undefined) {
            return;
        }
        const link = linkFor(current.model, current.engine, nodeId);
        if (!link) return;
        current.model.run("edge.add", {
            id: `${link.source}-${link.target}`,
            source: link.source,
            target: link.target,
        });
    }
}
