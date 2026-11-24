import { Component, signal } from "@angular/core";
import {
    createFlowModel,
    FLOW,
    type FlowEdgeInput,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { drag } from "@fragiola/flow-angular/drag";
import { keyboard } from "@fragiola/flow-angular/keyboard";
import { selection } from "@fragiola/flow-angular/selection";
import { DrawingLayer } from "./drawing-layer";
import { styles } from "./styles";
import { Toolbar } from "./toolbar";

// A whiteboard: a toolbar of tools over the flow. "Select" is the flow as usual (pan, drag,
// select). Every other tool lays a drawing layer over the flow that takes the pointer
// (`data-flow-no-gesture`: the engine leaves its presses alone) and turns its client points into
// flow coordinates (`screen-to-flow`); the pane's pan is off meanwhile (`[panOnDrag]`). "Rectangle"
// adds a node of the dragged box; "Freehand" smooths the pointer's points into a path
// (`stroke.ts`) and saves it as a node of its own, placed at the stroke's top-left corner with the
// path relative to it; "Eraser" removes the nodes and edges the pointer wipes over (`eraser.ts`),
// in one `batch` per wipe; "Lasso" selects the nodes wholly inside the shape it draws
// (`lasso.ts`, `selection.set`). The active tool is on the root (`data-tool`). The drawing layer
// (drawing-layer.ts) reads the pointer's points itself, so a move redraws it alone.

export interface Types extends FlowTypes {
    readonly nodes: {
        shape: { label: string };
        stroke: { label: string; d: string };
    };
}

const features = [selection(), drag(), keyboard()] as const;

export type Features = typeof features;

export type Tool = "select" | "rectangle" | "freehand" | "eraser" | "lasso";

const shape = (
    id: string,
    label: string,
    x: number,
    y: number,
): FlowNodeInput<Types> => ({
    id,
    type: "shape",
    position: { x, y },
    width: 130,
    height: 70,
    data: { label },
});

const nodes: FlowNodeInput<Types>[] = [
    shape("ideas", "Ideas", 0, 0),
    shape("sketch", "Sketch", 240, 0),
    shape("review", "Review", 480, 0),
    shape("notes", "Notes", 120, 200),
    {
        id: "underline",
        type: "stroke",
        position: { x: 316, y: 216 },
        width: 168,
        height: 28,
        data: {
            label: "Squiggle",
            d: "M4,14 L30,6 L56,20 L82,6 L108,20 L134,6 L164,14",
        },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "ideas-sketch", source: "ideas", target: "sketch", type: "straight" },
    {
        id: "sketch-review",
        source: "sketch",
        target: "review",
        type: "straight",
    },
];

const LABELS: Record<string, string> = Object.fromEntries(
    nodes.map((node) => [node.id, node.data.label]),
);

/** A stroke's path (none on a rectangle). */
const pathOf = (node: FlowNode<Types>) =>
    node.type === "stroke" ? node.data.d : undefined;

@Component({
    selector: "example-whiteboard",
    imports: [FLOW, DrawingLayer, Toolbar],
    host: { class: "contents" },
    template: `
        @let active = tool();
        <!-- a drawing tool's press draws: the pane does not pan under it -->
        <div
            flowRoot
            [model]="model"
            [fitView]="{ padding: 0.25, maxZoom: 1 }"
            [panOnDrag]="active === 'select'"
            role="group"
            aria-label="Whiteboard"
            [attr.data-tool]="active"
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
                            [attr.aria-label]="labels[edge.source] + ' to ' + labels[edge.target]"
                            [attr.data-erasing]="marked(edge.id)"
                            [class]="styles.edgeGroup"
                        >
                            <svg:path flowEdgePath [class]="styles.edge" />
                        </svg:g>
                    </ng-template>
                </div>
                <div flowNodes>
                    <ng-template [flowNodesItem]="model" let-node>
                        @if (node.type === "stroke") {
                            <div
                                [flowNode]="node"
                                role="group"
                                aria-roledescription="stroke"
                                [attr.aria-label]="node.data.label"
                                [attr.data-erasing]="marked(node.id)"
                                [class]="styles.stroke"
                            >
                                <svg aria-hidden="true" [class]="styles.strokeSvg">
                                    <svg:path [attr.d]="pathOf(node)" [class]="styles.strokePath" />
                                </svg>
                            </div>
                        } @else {
                            <div
                                [flowNode]="node"
                                role="group"
                                aria-roledescription="rectangle"
                                [attr.aria-label]="node.data.label"
                                [attr.data-erasing]="marked(node.id)"
                                [class]="styles.shape"
                            >
                                {{ node.data.label }}
                                <div flowHandle type="target" side="left" [class]="styles.handle"></div>
                                <div flowHandle type="source" side="right" [class]="styles.handle"></div>
                            </div>
                        }
                    </ng-template>
                </div>
            </div>
            <div flowSelectionBox [class]="styles.selectionBox"></div>
            @if (active !== "select") {
                <example-whiteboard-drawing-layer
                    [tool]="active"
                    (erasing)="erasing.set($event)"
                    (status)="status.set($event)"
                />
            }
            <example-whiteboard-toolbar
                [tool]="active"
                [status]="status()"
                (toolChange)="tool.set($event)"
            />
        </div>
    `,
})
export default class Whiteboard {
    protected readonly styles = styles;
    protected readonly labels = LABELS;
    protected readonly pathOf = pathOf;
    protected readonly tool = signal<Tool>("select");
    /** The ids the eraser's current wipe has touched: marked until it ends, then removed. */
    protected readonly erasing = signal<ReadonlySet<string>>(new Set());
    protected readonly status = signal("");
    protected readonly model = createFlowModel<Types, typeof features>(
        { version: 1, nodes, edges },
        { features },
    );

    protected marked(id: string): "" | null {
        return this.erasing().has(id) ? "" : null;
    }
}
