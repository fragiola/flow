import { Component, signal } from "@angular/core";
import {
    createFlowModel,
    FLOW,
    type FlowEdgeInput,
    type FlowEngineEventOf,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { connection } from "@fragiola/flow-angular/connection";
import { drag } from "@fragiola/flow-angular/drag";
import { reconnection } from "@fragiola/flow-angular/reconnection";
import { selection } from "@fragiola/flow-angular/selection";
import { styles } from "./styles";

// `reconnection()` (it needs `connection()`) lets an edge's end move: press a `Flow.ReconnectAnchor`
// (drawn here as a ring at each end) or the stroke near an end, and drop it on another handle. The
// edge keeps its id (`edge.reconnect`); dropped nowhere or on a refused handle, it goes back. The
// "locked" edge is not reconnectable (`reconnectable: false`).
//
// "Delete on drop" is app policy over the `reconnect-cancel` event (`(reconnectCancel)`): an end
// released over no handle (`dropped`, no `to`, not `refused`) removes its edge with `edge.remove`.

interface Types extends FlowTypes {
    readonly nodes: { device: { label: string } };
}

const features = [selection(), drag(), connection(), reconnection()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "router",
        type: "device",
        position: { x: 0, y: 100 },
        data: { label: "Router" },
    },
    {
        id: "laptop",
        type: "device",
        position: { x: 300, y: 0 },
        data: { label: "Laptop" },
    },
    {
        id: "printer",
        type: "device",
        position: { x: 300, y: 120 },
        data: { label: "Printer" },
    },
    {
        id: "tv",
        type: "device",
        position: { x: 300, y: 240 },
        data: { label: "TV" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "router-laptop", source: "router", target: "laptop" },
    { id: "router-tv", source: "router", target: "tv", reconnectable: false },
];

@Component({
    selector: "example-edge-reconnect",
    imports: [FLOW],
    host: { class: "contents" },
    template: `
        <div
            flowRoot
            [model]="model"
            [fitView]="{ padding: 0.2, maxZoom: 1 }"
            (reconnectCancel)="onReconnectCancel($event)"
            [class]="styles.root"
        >
            <svg flowBackground variant="dots" [size]="2" [class]="styles.dots"></svg>
            <svg flowBackground variant="lines" [class]="styles.lines"></svg>
            <svg flowBackground variant="cross" [class]="styles.cross"></svg>
            <div flowViewport>
                <div flowEdges>
                    <ng-template [flowEdgesItem]="model" let-edge>
                        <svg:g [flowEdge]="edge" [class]="styles.edgeGroup">
                            <svg:path flowEdgePath [class]="styles.edge" />
                            @if (edge.reconnectable === false) {
                                <xhtml:div flowEdgeLabel [class]="styles.label">locked</xhtml:div>
                            } @else {
                                <svg:circle flowReconnectAnchor end="source" [class]="styles.anchor" />
                                <svg:circle flowReconnectAnchor end="target" [class]="styles.anchor" />
                            }
                        </svg:g>
                    </ng-template>
                </div>
                <div flowNodes>
                    <ng-template [flowNodesItem]="model" let-node>
                        <div [flowNode]="node" [class]="styles.node">
                            {{ node.data.label }}
                            <div flowHandle type="target" side="left" [class]="styles.handle"></div>
                            <div flowHandle type="source" side="right" [class]="styles.handle"></div>
                        </div>
                    </ng-template>
                </div>
                <svg flowConnectionLine [class]="styles.connection"></svg>
            </div>
            <label data-flow-no-gesture [class]="styles.option">
                <input
                    type="checkbox"
                    role="switch"
                    [checked]="deleteOnDrop()"
                    [attr.aria-checked]="deleteOnDrop()"
                    (change)="toggleDeleteOnDrop($event)"
                    [class]="styles.switch"
                />
                Delete on drop
            </label>
        </div>
    `,
})
export default class EdgeReconnect {
    protected readonly styles = styles;
    protected readonly model = createFlowModel<Types, typeof features>(
        { version: 1, nodes, edges },
        { features },
    );
    protected readonly deleteOnDrop = signal(false);

    protected toggleDeleteOnDrop(event: Event): void {
        this.deleteOnDrop.set((event.target as HTMLInputElement).checked);
    }

    /** An end dropped on the pane, with "Delete on drop" on: the edge goes. */
    protected onReconnectCancel(event: FlowEngineEventOf<"reconnect-cancel">) {
        if (
            !this.deleteOnDrop() ||
            !event.dropped ||
            event.to ||
            event.refused
        ) {
            return;
        }
        this.model.run("edge.remove", { edgeId: event.edgeId });
    }
}
