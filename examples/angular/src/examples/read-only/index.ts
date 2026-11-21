import { Component } from "@angular/core";
import {
    createFlowModel,
    FLOW,
    type FlowEdgeInput,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-angular";
import {
    LucideLock,
    LucideMaximize,
    LucideMinus,
    LucidePlus,
} from "@lucide/angular";
import { Badge } from "#/components/atoms/badge";
import { styles } from "./styles";

// A flow with no features is a diagram: it draws, pans and zooms (the core's viewport), and
// nothing in it can be selected, dragged, connected or deleted. Add a feature to the list to opt
// into its gesture. The handles stay as anchors for the edges.

interface Types extends FlowTypes {
    readonly nodes: {
        service: { label: string; kind: "client" | "service" | "store" };
    };
}

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "web",
        type: "service",
        position: { x: 0, y: 0 },
        data: { label: "Web app", kind: "client" },
    },
    {
        id: "mobile",
        type: "service",
        position: { x: 220, y: 0 },
        data: { label: "Mobile app", kind: "client" },
    },
    {
        id: "api",
        type: "service",
        position: { x: 110, y: 130 },
        data: { label: "API gateway", kind: "service" },
    },
    {
        id: "auth",
        type: "service",
        position: { x: -60, y: 260 },
        data: { label: "Auth", kind: "service" },
    },
    {
        id: "orders",
        type: "service",
        position: { x: 280, y: 260 },
        data: { label: "Orders", kind: "service" },
    },
    {
        id: "db",
        type: "service",
        position: { x: 110, y: 390 },
        data: { label: "Postgres", kind: "store" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "web-api", source: "web", target: "api", type: "smoothstep" },
    { id: "mobile-api", source: "mobile", target: "api", type: "smoothstep" },
    { id: "api-auth", source: "api", target: "auth", type: "smoothstep" },
    { id: "api-orders", source: "api", target: "orders", type: "smoothstep" },
    { id: "auth-db", source: "auth", target: "db", type: "smoothstep" },
    { id: "orders-db", source: "orders", target: "db", type: "smoothstep" },
];

const features = [] as const;

@Component({
    selector: "example-read-only",
    imports: [FLOW, Badge, LucideLock, LucideMaximize, LucideMinus, LucidePlus],
    host: { class: "contents" },
    template: `
        <div flowRoot [model]="model" [fitView]="{ padding: 0.2, maxZoom: 1 }" [class]="styles.root">
            <svg flowBackground variant="dots" [size]="2" [class]="styles.dots"></svg>
            <svg flowBackground variant="lines" [class]="styles.lines"></svg>
            <svg flowBackground variant="cross" [class]="styles.cross"></svg>
            <div flowViewport>
                <div flowEdges>
                    <ng-template [flowEdgesItem]="model" let-edge>
                        <svg:g [flowEdge]="edge">
                            <svg:path flowEdgePath [class]="styles.edge" />
                        </svg:g>
                    </ng-template>
                </div>
                <div flowNodes>
                    <ng-template [flowNodesItem]="model" let-node>
                        <div [flowNode]="node" [class]="styles.node(node.data.kind)">
                            {{ node.data.label }}
                            <div flowHandle type="target" side="top" [class]="styles.anchor"></div>
                            <div flowHandle type="source" side="bottom" [class]="styles.anchor"></div>
                        </div>
                    </ng-template>
                </div>
            </div>
            <span kitBadge variant="outline" [class]="styles.badge">
                <svg lucideLock aria-hidden="true"></svg>
                Read-only
            </span>
            <div flowControls role="group" aria-label="Zoom" [class]="styles.controls">
                <button flowZoomIn aria-label="Zoom in" [class]="styles.control">
                    <svg lucidePlus aria-hidden="true"></svg>
                </button>
                <button flowZoomOut aria-label="Zoom out" [class]="styles.control">
                    <svg lucideMinus aria-hidden="true"></svg>
                </button>
                <button flowFitView aria-label="Fit view" [class]="styles.control">
                    <svg lucideMaximize aria-hidden="true"></svg>
                </button>
            </div>
        </div>
    `,
})
export default class ReadOnly {
    protected readonly styles = styles;
    protected readonly model = createFlowModel<Types, typeof features>(
        { version: 1, nodes, edges },
        { features },
    );
}
