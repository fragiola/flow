import { Component } from "@angular/core";
import {
    createFlowModel,
    FLOW,
    type FlowEdge,
    type FlowJson,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { drag } from "@fragiola/flow-angular/drag";
import { keyboard } from "@fragiola/flow-angular/keyboard";
import { selection } from "@fragiola/flow-angular/selection";
import { LucideMaximize, LucideMinus, LucidePlus } from "@lucide/angular";
import { CallEdge } from "./call-edge";
import { ServiceNode } from "./service-node";
import { styles } from "./styles";
import { ZoomReadout } from "./zoom-readout";

// The nodes show more as the flow zooms in: at a glance only their name, closer their kind and
// health, closest their owner and figures. The edges' labels show from a zoom of 1. The zoom is
// view state: `injectViewport()` gives it, read only in components of their own, so a pan or zoom
// re-checks them alone: the readout in the corner (zoom-readout.ts) follows every frame, and a
// node (service-node.ts) or an edge (call-edge.ts) takes a `computed` of it (`detailOf(zoom)`, a
// string), so its view updates when its level changes, not on every frame. The thresholds live
// in `detail.ts`; each node carries its level as `data-detail`.

// a type, not an interface: `[flowNode]` takes a node whose data is a `Record<string, unknown>`
type Service = {
    label: string;
    kind: string;
    owner: string;
    health: "healthy" | "degraded";
    requests: string;
    latency: string;
};

export interface Types extends FlowTypes {
    readonly nodes: { service: Service };
    readonly edges: { call: { label: string } };
}

const features = [selection(), drag(), keyboard()] as const;
const service = (id: string, x: number, y: number, data: Service) => ({
    id,
    type: "service" as const,
    position: { x, y },
    data,
});

const call = (source: string, target: string, label: string) => ({
    id: `${source}-${target}`,
    source,
    target,
    type: "call" as const,
    data: { label },
});

const json: FlowJson<Types> = {
    version: 1,
    nodes: [
        service("gateway", 0, 120, {
            label: "Gateway",
            kind: "Edge proxy",
            owner: "Platform",
            health: "healthy",
            requests: "1.2k req/s",
            latency: "18 ms",
        }),
        service("orders", 300, 0, {
            label: "Orders",
            kind: "HTTP service",
            owner: "Commerce",
            health: "healthy",
            requests: "340 req/s",
            latency: "42 ms",
        }),
        service("search", 300, 240, {
            label: "Search",
            kind: "HTTP service",
            owner: "Discovery",
            health: "degraded",
            requests: "860 req/s",
            latency: "310 ms",
        }),
        service("billing", 600, 0, {
            label: "Billing",
            kind: "Worker",
            owner: "Payments",
            health: "healthy",
            requests: "75 jobs/s",
            latency: "90 ms",
        }),
        service("index", 600, 240, {
            label: "Index",
            kind: "Database",
            owner: "Discovery",
            health: "healthy",
            requests: "2.4k reads/s",
            latency: "4 ms",
        }),
    ],
    edges: [
        call("gateway", "orders", "POST /orders"),
        call("gateway", "search", "GET /search"),
        call("orders", "billing", "charge"),
        call("search", "index", "query"),
    ],
};

/** The nodes' labels, for the edges' names. */
const LABELS: Record<string, string> = Object.fromEntries(
    json.nodes.map((node) => [node.id, node.data.label]),
);

const labelOf = (id: string) => LABELS[id] ?? id;

@Component({
    selector: "example-contextual-zoom",
    imports: [
        FLOW,
        CallEdge,
        ServiceNode,
        ZoomReadout,
        LucideMaximize,
        LucideMinus,
        LucidePlus,
    ],
    host: { class: "contents" },
    template: `
        <div
            flowRoot
            [model]="model"
            [fitView]="{ padding: 0.2, maxZoom: 1 }"
            [minZoom]="0.4"
            [maxZoom]="2"
            role="group"
            aria-label="Contextual zoom"
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
                            exampleCallEdge
                            role="group"
                            aria-roledescription="edge"
                            [attr.aria-label]="name(edge)"
                            [class]="styles.edgeGroup"
                        ></svg:g>
                    </ng-template>
                </div>
                <div flowNodes>
                    <ng-template [flowNodesItem]="model" let-node>
                        <div
                            [flowNode]="node"
                            exampleServiceNode
                            role="group"
                            aria-roledescription="service"
                            [attr.aria-label]="node.data.label"
                            [class]="styles.node"
                        ></div>
                    </ng-template>
                </div>
            </div>
            <div flowControls role="group" aria-label="Zoom" [class]="styles.controls">
                <button flowZoomIn [duration]="200" aria-label="Zoom in" [class]="styles.control">
                    <svg lucidePlus aria-hidden="true"></svg>
                </button>
                <button flowZoomOut [duration]="200" aria-label="Zoom out" [class]="styles.control">
                    <svg lucideMinus aria-hidden="true"></svg>
                </button>
                <button
                    flowFitView
                    [duration]="200"
                    [padding]="0.2"
                    [maxZoom]="1"
                    aria-label="Fit view"
                    [class]="styles.control"
                >
                    <svg lucideMaximize aria-hidden="true"></svg>
                </button>
            </div>
            <p exampleZoomReadout data-testid="zoom-readout" [class]="styles.readout"></p>
        </div>
    `,
})
export default class ContextualZoom {
    protected readonly styles = styles;
    protected readonly model = createFlowModel<Types, typeof features>(json, {
        features,
    });

    /** An edge's name: its ends and its label. */
    protected name(edge: FlowEdge<Types>): string {
        const text = edge.type === "call" ? (edge.data?.label ?? "") : "";
        return `${labelOf(edge.source)} to ${labelOf(edge.target)}: ${text}`;
    }
}
