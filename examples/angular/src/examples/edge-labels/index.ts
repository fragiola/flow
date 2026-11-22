import { Component } from "@angular/core";
import {
    createFlowModel,
    FLOW,
    type FlowEdge,
    type FlowEdgeInput,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { connection } from "@fragiola/flow-angular/connection";
import { drag } from "@fragiola/flow-angular/drag";
import { selection } from "@fragiola/flow-angular/selection";
import { LucideRefreshCw, LucideTrash2, LucideX } from "@lucide/angular";
import { Badge } from "#/components/atoms/badge";
import { styles } from "./styles";

// `flowEdgeLabel` is HTML placed at the edge's label point (halfway along its path), in flow
// coordinates: it pans and zooms with the edge. It may hold anything: text from the edge's data, a
// badge, a button. A button in a label keeps its own clicks (it never starts a gesture).
// `flowEdgeToolbar` stands at the same point but outside the zoom (it keeps its size), moved up by
// `offset`, and shows while its edge is selected: click an edge for its actions.

interface Types extends FlowTypes {
    readonly nodes: { stage: { label: string } };
    readonly edges: {
        text: { text: string };
        status: { status: "passing" | "failing" };
        removable: Record<string, never>;
    };
}

const features = [selection(), drag(), connection()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "build",
        type: "stage",
        position: { x: 0, y: 0 },
        data: { label: "Build" },
    },
    {
        id: "test",
        type: "stage",
        position: { x: 280, y: 0 },
        data: { label: "Test" },
    },
    {
        id: "lint",
        type: "stage",
        position: { x: 280, y: 180 },
        data: { label: "Lint" },
    },
    {
        id: "deploy",
        type: "stage",
        position: { x: 560, y: 90 },
        data: { label: "Deploy" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    {
        id: "build-test",
        source: "build",
        target: "test",
        type: "text",
        data: { text: "on push" },
    },
    {
        id: "build-lint",
        source: "build",
        target: "lint",
        type: "status",
        data: { status: "failing" },
        selected: true,
    },
    {
        id: "test-deploy",
        source: "test",
        target: "deploy",
        type: "status",
        data: { status: "passing" },
    },
    {
        id: "lint-deploy",
        source: "lint",
        target: "deploy",
        type: "removable",
        data: {},
    },
];

@Component({
    selector: "example-edge-labels",
    imports: [FLOW, Badge, LucideRefreshCw, LucideTrash2, LucideX],
    host: { class: "contents" },
    template: `
        <div
            flowRoot
            [model]="model"
            [fitView]="{ padding: 0.2, maxZoom: 1 }"
            [pathOptions]="{ borderRadius: 8 }"
            [class]="styles.root"
        >
            <svg flowBackground variant="dots" [size]="2" [class]="styles.dots"></svg>
            <svg flowBackground variant="lines" [class]="styles.lines"></svg>
            <svg flowBackground variant="cross" [class]="styles.cross"></svg>
            <div flowViewport>
                <div flowEdges>
                    <ng-template [flowEdgesItem]="model" let-edge>
                        <svg:g [flowEdge]="edge" [class]="styles.edgeGroup">
                            <!-- a wide transparent path: a bigger target for a click -->
                            <svg:path flowEdgePath [class]="styles.edgeHit" />
                            <svg:path flowEdgePath [class]="styles.edge" />
                            <xhtml:div flowEdgeLabel [class]="styles.label">
                                @if (edge.type === "text") {
                                    <span [class]="styles.text">{{ edge.data?.text }}</span>
                                } @else if (edge.type === "status") {
                                    <span kitBadge variant="soft" [class]="styles.status(edge.data?.status)">
                                        {{ edge.data?.status }}
                                    </span>
                                } @else if (edge.type === "removable") {
                                    <!-- removes the edge (edge.remove) -->
                                    <button
                                        type="button"
                                        [attr.aria-label]="'Remove the edge from ' + edge.source + ' to ' + edge.target"
                                        [class]="styles.remove"
                                        (click)="remove(edge)"
                                    >
                                        <svg lucideX aria-hidden="true"></svg>
                                    </button>
                                }
                            </xhtml:div>
                            <!-- the selected edge's actions: flip a status, remove the edge -->
                            <xhtml:div
                                flowEdgeToolbar
                                [offset]="{ x: 0, y: -36 }"
                                role="toolbar"
                                [attr.aria-label]="edge.source + ' to ' + edge.target + ': actions'"
                                [class]="styles.toolbar"
                            >
                                @if (edge.type === "status") {
                                    <button
                                        type="button"
                                        [attr.aria-label]="edge.data?.status === 'failing' ? 'Mark it passing' : 'Mark it failing'"
                                        [class]="styles.action"
                                        (click)="flip(edge)"
                                    >
                                        <svg lucideRefreshCw aria-hidden="true"></svg>
                                    </button>
                                }
                                <button
                                    type="button"
                                    aria-label="Remove it"
                                    [class]="styles.danger"
                                    (click)="remove(edge)"
                                >
                                    <svg lucideTrash2 aria-hidden="true"></svg>
                                </button>
                            </xhtml:div>
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
        </div>
    `,
})
export default class EdgeLabels {
    protected readonly styles = styles;
    protected readonly model = createFlowModel<Types, typeof features>(
        { version: 1, nodes, edges },
        { features },
    );

    protected flip(edge: FlowEdge<Types>): void {
        if (edge.type !== "status") return;
        this.model.run("edge.set-data", {
            edgeId: edge.id,
            data: {
                status: edge.data?.status === "failing" ? "passing" : "failing",
            },
        });
    }

    protected remove(edge: FlowEdge<Types>): void {
        this.model.run("edge.remove", { edgeId: edge.id });
    }
}
