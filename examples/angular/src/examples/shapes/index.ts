import { Component, signal } from "@angular/core";
import {
    createFlowModel,
    FLOW,
    type FlowEdgeInput,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { connection } from "@fragiola/flow-angular/connection";
import { drag } from "@fragiola/flow-angular/drag";
import { keyboard } from "@fragiola/flow-angular/keyboard";
import { resize } from "@fragiola/flow-angular/resize";
import { selection } from "@fragiola/flow-angular/selection";
import { ShapeNode } from "./shape-node";
import { SHAPE_NAMES, type Shape } from "./shape-path";
import { styles } from "./styles";

// A flowchart: each node draws its shape as an SVG path sized to the node (`shape-path.ts`), and
// the selected node's toolbar picks another shape (`node.set-data`, shape-picker.ts). The node is
// resized from its corners and sides (`flowNodeResizer`), and turned from the knob above it
// (rotate-handle.ts): the angle is the node's data, applied by the node's own `rotate()` on its
// content. Its handles turn with it, and each one takes the side it now faces (`rotation.ts`), so
// its edges leave the way it points; the handles are remounted on a turn (a one-item `@for`
// tracked by the angle), since a transform changes no size the engine would notice. The knob is a
// slider: drag it (Shift snaps to 15°) or use the arrows. Double-click a node
// (`(nodeDoubleClick)`), or press its toolbar's pencil, to edit its label in place
// (shape-label.ts): Enter keeps it, Escape drops it.

export interface Types extends FlowTypes {
    readonly nodes: { shape: { label: string; shape: Shape; angle: number } };
}

export type Node = FlowNode<Types>;

export const features = [
    selection(),
    drag(),
    connection(),
    resize({ minWidth: 60, minHeight: 40 }),
    keyboard(),
] as const;

/** A node of the chart: its id, place, size, shape and label. */
function chartNode(
    id: string,
    shape: Shape,
    label: string,
    x: number,
    y: number,
    width = 140,
    height = 64,
): FlowNodeInput<Types> {
    return {
        id,
        type: "shape",
        position: { x, y },
        width,
        height,
        data: { label, shape, angle: 0 },
    };
}

const nodes: FlowNodeInput<Types>[] = [
    chartNode("start", "circle", "Start", 130, 0, 140, 56),
    chartNode("read", "parallelogram", "Read order", 130, 110, 140, 56),
    {
        ...chartNode("check", "diamond", "In stock?", 130, 240, 140, 88),
        selected: true,
    },
    chartNode("reject", "rounded", "Notify buyer", 0, 400, 140, 56),
    chartNode("pick", "rectangle", "Pick items", 260, 400, 140, 56),
    chartNode("log", "cylinder", "Log reason", 0, 510, 140, 72),
    chartNode("ship", "hexagon", "Ship", 260, 510, 140, 56),
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "start-read", source: "start", target: "read" },
    { id: "read-check", source: "read", target: "check" },
    { id: "check-reject", source: "check", target: "reject" },
    { id: "check-pick", source: "check", target: "pick" },
    { id: "reject-log", source: "reject", target: "log" },
    { id: "pick-ship", source: "pick", target: "ship" },
];

@Component({
    selector: "example-shapes",
    imports: [FLOW, ShapeNode],
    host: { class: "contents" },
    template: `
        <div
            flowRoot
            [model]="model"
            [fitView]="{ padding: 0.2, maxZoom: 1 }"
            role="group"
            aria-label="Order flowchart"
            [class]="styles.root"
            (nodeDoubleClick)="editing.set($event.nodeId)"
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
                    <!-- one template for every node: a change renders only the node it touched -->
                    <ng-template [flowNodesItem]="model" let-node>
                        <div
                            [flowNode]="node"
                            [exampleShapeNode]="node"
                            [editing]="editing() === node.id"
                            (editingChange)="editing.set($event ? node.id : undefined)"
                            role="group"
                            aria-roledescription="node"
                            [attr.aria-label]="node.data.label + ' (' + names[node.data.shape] + ')'"
                            [class]="styles.node"
                        ></div>
                    </ng-template>
                </div>
                <svg flowConnectionLine [class]="styles.connection"></svg>
            </div>
            <p [class]="styles.hint">
                Drag the knob to rotate (Shift snaps) · double-click a node to edit its label
            </p>
        </div>
    `,
})
export default class Shapes {
    protected readonly styles = styles;
    protected readonly names = SHAPE_NAMES;
    /** Which node's label is edited in place (one at a time). */
    protected readonly editing = signal<string | undefined>(undefined);
    protected readonly model = createFlowModel<Types, typeof features>(
        { version: 1, nodes, edges },
        { features },
    );
}
