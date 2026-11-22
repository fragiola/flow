import { Component } from "@angular/core";
import {
    createFlowModel,
    FLOW,
    type FlowEdgeInput,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { connection } from "@fragiola/flow-angular/connection";
import { drag } from "@fragiola/flow-angular/drag";
import { keyboard } from "@fragiola/flow-angular/keyboard";
import { selection } from "@fragiola/flow-angular/selection";
import { SelectionStatus } from "./selection-status";
import { styles } from "./styles";

// `selection()` selects with a click, adds with Shift (or Ctrl/Cmd) and draws a box with Shift and
// a drag on the canvas; `keyboard()` makes nodes and edges focusable: Tab moves through them, Enter
// or Space selects, the arrows move the selection (Shift for a bigger step), Delete removes it and
// Escape clears it. With `connection()` too, Tab also reaches the handles: Enter on one starts a
// connection, Tab (or the arrows) points at the next handle that accepts it, Enter draws the edge
// and Escape cancels. A box around two or more nodes leaves a rectangle around them
// (`flowNodesSelection`): dragging it moves the whole selection. The package names nothing: each
// node, handle and edge gets its name here.

export interface Types extends FlowTypes {
    readonly nodes: { task: { label: string } };
}

const features = [selection(), drag(), connection(), keyboard()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "design",
        type: "task",
        position: { x: 0, y: 0 },
        data: { label: "Design" },
    },
    {
        id: "build",
        type: "task",
        position: { x: 220, y: 0 },
        data: { label: "Build" },
    },
    {
        id: "review",
        type: "task",
        position: { x: 440, y: 0 },
        data: { label: "Review" },
    },
    {
        id: "docs",
        type: "task",
        position: { x: 220, y: 150 },
        data: { label: "Docs" },
    },
    {
        id: "ship",
        type: "task",
        position: { x: 440, y: 150 },
        data: { label: "Ship" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "design-build", source: "design", target: "build" },
    { id: "build-review", source: "build", target: "review" },
    { id: "build-docs", source: "build", target: "docs" },
    { id: "review-ship", source: "review", target: "ship" },
    { id: "docs-ship", source: "docs", target: "ship" },
];

@Component({
    selector: "example-selection-and-keyboard",
    imports: [FLOW, SelectionStatus],
    host: { class: "contents" },
    template: `
        <div
            flowRoot
            [model]="model"
            [fitView]="{ padding: 0.2, maxZoom: 1 }"
            role="group"
            aria-label="Release plan"
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
                            [attr.aria-label]="edge.source + ' to ' + edge.target"
                            [class]="styles.edgeGroup"
                        >
                            <!-- a wide transparent path: a bigger target for a click -->
                            <svg:path flowEdgePath [class]="styles.edgeHit" />
                            <svg:path flowEdgePath [class]="styles.edge" />
                        </svg:g>
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
                            <div
                                flowHandle
                                type="target"
                                side="left"
                                [attr.aria-label]="node.data.label + ' input'"
                                [class]="styles.handle"
                            ></div>
                            <div
                                flowHandle
                                type="source"
                                side="right"
                                [attr.aria-label]="node.data.label + ' output'"
                                [class]="styles.handle"
                            ></div>
                        </div>
                    </ng-template>
                </div>
                <svg flowConnectionLine [class]="styles.connection"></svg>
                <div flowNodesSelection [class]="styles.nodesSelection"></div>
            </div>
            <div flowSelectionBox [class]="styles.box"></div>
            <example-selection-status />
            <p [class]="styles.hint">
                Shift + drag draws a box, drag its rectangle to move it · Tab, arrows, Delete, Escape · Enter on a handle connects
            </p>
        </div>
    `,
})
export default class SelectionAndKeyboard {
    protected readonly styles = styles;
    protected readonly model = createFlowModel<Types, typeof features>(
        { version: 1, nodes, edges },
        { features },
    );
}
