import { Component, computed, inject, input } from "@angular/core";
import {
    createFlowModel,
    createFlowRef,
    FLOW,
    type FlowModel,
} from "@fragiola/flow-angular";
import { connection } from "@fragiola/flow-angular/connection";
import { drag } from "@fragiola/flow-angular/drag";
import { keyboard } from "@fragiola/flow-angular/keyboard";
import {
    FLOW_MINIMAP,
    FlowMiniMapDirective,
    minimap,
} from "@fragiola/flow-angular/minimap";
import { reconnection } from "@fragiola/flow-angular/reconnection";
import { selection } from "@fragiola/flow-angular/selection";
import {
    LucideMaximize,
    LucideMinus,
    LucidePlus,
    LucideWorkflow,
} from "@lucide/angular";
import { Badge } from "#/components/atoms/badge";
import { CATALOG, type CatalogEntry, TYPE_LABELS } from "./catalog";
import { initialWorkflow } from "./data";
import { injectWorkflow } from "./inject-workflow";
import { Inspector } from "./inspector";
import { Palette, STEP_MIME } from "./palette";
import { issuesOf, workflowRules } from "./rules";
import { StepNode } from "./step-node";
import { styles } from "./styles";
import type { Types } from "./types";

// An automation editor built from the primitives: a palette of typed steps (drag one in, or click
// it), custom nodes with typed ports, connection rules as a middleware (a refused port turns red
// while you drag), a condition's two branches labelled on their edges, the inspector of the
// selected step, a minimap and the zoom controls. The palette and the inspector sit beside the
// root and work on the same model.

const features = [
    selection(),
    drag({ snapGrid: [10, 10] }),
    connection(),
    reconnection(),
    keyboard(),
    minimap(),
] as const;

type Features = typeof features;

let added = 0;

/** The header's status: how many issues the workflow has left. */
@Component({
    selector: "example-workflow-status",
    imports: [Badge],
    host: { class: "contents" },
    template: `
        <span kitBadge variant="soft" data-testid="status" [class]="styles.statusBadge(count() === 0)">
            {{ count() === 0 ? "Ready" : count() + (count() > 1 ? " issues" : " issue") }}
        </span>
        <button type="button" [disabled]="count() > 0" [class]="styles.publish">Publish</button>
    `,
})
class Status {
    readonly model = input.required<FlowModel<Types, Features>>();
    protected readonly styles = styles;
    private readonly workflow = injectWorkflow(this.model);
    protected readonly count = computed(() => {
        const edges = this.workflow.edges();
        return this.workflow
            .steps()
            .reduce((sum, step) => sum + issuesOf(step, edges).length, 0);
    });
}

/**
 * The minimap's content, on the minimap's element: its view changes on every pan and drag step,
 * and only this template reads it (in the example's template it would check every step again).
 */
@Component({
    selector: "svg[exampleWorkflowMinimap]",
    imports: [FLOW_MINIMAP],
    template: `
        @for (item of map.state().view.nodes; track item.nodeId) {
            <!-- a minimap node leaves the document while hidden: never an @for's first element -->
            <svg:g>
                <svg:rect flowMiniMapNode [nodeId]="item.nodeId" [class]="styles.minimapNode" />
            </svg:g>
        }
        <svg:path flowMiniMapMask [class]="styles.minimapMask" />
    `,
})
class WorkflowMinimap {
    protected readonly styles = styles;
    protected readonly map = inject(FlowMiniMapDirective);
}

@Component({
    selector: "example-workflow-builder",
    imports: [
        FLOW,
        FLOW_MINIMAP,
        WorkflowMinimap,
        LucideWorkflow,
        LucidePlus,
        LucideMinus,
        LucideMaximize,
        Status,
        Palette,
        Inspector,
        StepNode,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.app">
            <header [class]="styles.header">
                <span [class]="styles.logo"><svg lucideWorkflow aria-hidden="true"></svg></span>
                <div [class]="styles.headerText">
                    <h1 [class]="styles.appTitle">Order follow-up</h1>
                    <p [class]="styles.breadcrumb">Automations · Draft</p>
                </div>
                <example-workflow-status [model]="model" />
            </header>
            <example-workflow-palette (add)="addStep($event)" />
            <div
                flowRoot
                [model]="model"
                [flowRef]="flow"
                [fitView]="{ padding: 0.08, maxZoom: 1 }"
                [minZoom]="0.3"
                [pathOptions]="{ borderRadius: 10 }"
                aria-label="Workflow canvas"
                role="group"
                [class]="styles.root"
                (dragover)="onDragOver($event)"
                (drop)="onDrop($event)"
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
                                aria-roledescription="connection"
                                [attr.aria-label]="edge.source + ' to ' + edge.target"
                                [class]="styles.edgeGroup"
                            >
                                <svg:path flowEdgePath [class]="styles.edgeHit" />
                                <svg:path flowEdgePath [class]="styles.edge" />
                                <!-- a condition's outputs are its branches: the edge says which it leaves by -->
                                @if (edge.sourceHandle === "yes" || edge.sourceHandle === "no") {
                                    <xhtml:div flowEdgeLabel [class]="styles.branchLabel(edge.sourceHandle)">
                                        {{ edge.sourceHandle }}
                                    </xhtml:div>
                                }
                            </svg:g>
                        </ng-template>
                    </div>
                    <div flowNodes>
                        <ng-template [flowNodesItem]="model" let-step>
                            <div
                                [flowNode]="step"
                                [exampleWorkflowStep]="step"
                                role="group"
                                aria-roledescription="step"
                                [attr.aria-label]="labels[step.type] + ': ' + step.data.title"
                                [class]="styles.step"
                            ></div>
                        </ng-template>
                    </div>
                    <svg flowConnectionLine [class]="styles.connection"></svg>
                </div>
                <div flowSelectionBox [class]="styles.box"></div>
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
                <svg
                    flowMiniMap
                    exampleWorkflowMinimap
                    [width]="120"
                    [height]="84"
                    role="img"
                    aria-label="Minimap of the workflow"
                    [class]="styles.minimap"
                ></svg>
            </div>
            <example-workflow-inspector [model]="model" />
        </div>
    `,
})
export default class WorkflowBuilder {
    protected readonly styles = styles;
    protected readonly labels = TYPE_LABELS;
    protected readonly model = createModel();
    protected readonly flow = createFlowRef<Types, Features>();

    /** Adds a step centred on a client point (a drop's, or the canvas' centre). */
    protected addStep(
        entry: CatalogEntry,
        client?: { x: number; y: number },
    ): void {
        const current = this.flow.current;
        if (!current) return;
        const size = current.engine.get("root-size");
        const viewport = current.engine.get("viewport");
        const point = client
            ? current.engine.get("screen-to-flow", client)
            : {
                  x: (size.width / 2 - viewport.x) / viewport.zoom,
                  y: (size.height / 2 - viewport.y) / viewport.zoom,
              };
        added += 1;
        const id = `${entry.id}-${added}`;
        // the new step is centred on the point, and selected so the inspector shows it
        current.model.run("batch", {
            commands: [
                {
                    command: "node.add",
                    payload: entry.create(id, {
                        x: Math.round(point.x - 110),
                        y: Math.round(point.y - 30),
                    }),
                },
                { command: "selection.set", payload: { nodeIds: [id] } },
            ],
        });
    }

    protected onDragOver(event: DragEvent): void {
        if (!event.dataTransfer?.types.includes(STEP_MIME)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
    }

    protected onDrop(event: DragEvent): void {
        const entry = CATALOG.find(
            (item) => item.id === event.dataTransfer?.getData(STEP_MIME),
        );
        if (!entry) return;
        event.preventDefault();
        this.addStep(entry, { x: event.clientX, y: event.clientY });
    }
}

/** The workflow's model, with its rules. */
function createModel(): FlowModel<Types, Features> {
    const created = createFlowModel<Types, Features>(initialWorkflow, {
        features,
    });
    created.use(workflowRules);
    // every connection is drawn as a smooth step, like the workflow's own
    created.use((ctx, next) => {
        if (ctx.command === "edge.add") {
            ctx.payload = { ...ctx.payload, type: "smoothstep" };
        }
        return next();
    });
    return created;
}
