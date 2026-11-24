import { Component } from "@angular/core";
import {
    createFlowModel,
    createFlowRef,
    FLOW,
    type FlowEdge,
    type FlowEdgeInput,
    type FlowEngineEventOf,
    type FlowJson,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { drag } from "@fragiola/flow-angular/drag";
import { keyboard } from "@fragiola/flow-angular/keyboard";
import { selection } from "@fragiola/flow-angular/selection";
import { Actions } from "./actions";
import { BendableEdge } from "./bendable-edge";
import { insertPoint, type Point } from "./control-points";
import { styles } from "./styles";

// An edge the user shapes. Its control points live in the edge's `data` (`points`, in flow
// coordinates) and change through the model (`edge.set-data`): the edge is drawn from its source
// end through them to its target end (`control-points.ts`), so they override any route. Drag a
// point to bend the edge (`screen-to-flow` turns the pointer into flow coordinates), double-click
// the edge to add one where you clicked (`(edgeDoubleClick)`), and press Delete on a focused
// point to remove it; the arrows move it. A point is a control of its own
// (`data-flow-no-gesture`): pressing it neither pans the pane nor drags a node. "Route" asks the
// grid search of `routing.ts` for an orthogonal way around every node's box (`node-rect-by`) and
// stores its corners as the points; "Clear points" straightens the edges.

export interface Types extends FlowTypes {
    readonly nodes: { box: { label: string; obstacle: boolean } };
    readonly edges: { editable: { points: Point[] } };
}

const features = [selection(), drag(), keyboard()] as const;

export type Features = typeof features;

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

const json: FlowJson<Types> = { version: 1, nodes, edges };

const LABELS: Record<string, string> = Object.fromEntries(
    nodes.map((node) => [node.id, node.data.label]),
);

export const nameOf = (edge: { source: string; target: string }) =>
    `${LABELS[edge.source]} to ${LABELS[edge.target]}`;

/** The control points of an edge (none on an edge of another type). */
export const pointsOf = (edge: FlowEdge<Types> | undefined): Point[] =>
    edge?.type === "editable" ? (edge.data?.points ?? []) : [];

@Component({
    selector: "example-editable-edge",
    imports: [FLOW, Actions, BendableEdge],
    host: { class: "contents" },
    template: `
        <div
            flowRoot
            [model]="model"
            [fitView]="{ padding: 0.2, maxZoom: 1 }"
            [flowRef]="flow"
            (edgeDoubleClick)="onEdgeDoubleClick($event)"
            role="group"
            aria-label="Editable edge"
            [class]="styles.root"
        >
            <svg flowBackground variant="dots" [size]="2" [class]="styles.dots"></svg>
            <svg flowBackground variant="lines" [class]="styles.lines"></svg>
            <svg flowBackground variant="cross" [class]="styles.cross"></svg>
            <div flowViewport>
                <div flowEdges>
                    <ng-template [flowEdgesItem]="model" let-edge>
                        @if (edge.type === "editable") {
                            <svg:g
                                [flowEdge]="edge"
                                exampleBendableEdge
                                role="group"
                                aria-roledescription="edge"
                                [class]="styles.edgeGroup"
                            ></svg:g>
                        }
                    </ng-template>
                </div>
                <div flowNodes>
                    <ng-template [flowNodesItem]="model" let-node>
                        <div
                            [flowNode]="node"
                            role="group"
                            aria-roledescription="node"
                            [attr.aria-label]="node.data.label"
                            [class]="styles.node"
                        >
                            {{ node.data.label }}
                            @if (!node.data.obstacle) {
                                <div flowHandle type="target" side="left" [class]="styles.handle"></div>
                                <div flowHandle type="source" side="right" [class]="styles.handle"></div>
                            }
                        </div>
                    </ng-template>
                </div>
            </div>
            <example-editable-edge-actions />
        </div>
    `,
})
export default class EditableEdge {
    protected readonly styles = styles;
    protected readonly model = createFlowModel<Types, typeof features>(json, {
        features,
    });
    protected readonly flow = createFlowRef<Types, typeof features>();

    /** A double click on an edge: a point there, in the run nearest to it. */
    protected onEdgeDoubleClick(
        event: FlowEngineEventOf<"edge-double-click">,
    ): void {
        const current = this.flow.current;
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
}
