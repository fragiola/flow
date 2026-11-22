import { Component } from "@angular/core";
import {
    createFlowModel,
    FLOW,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { drag } from "@fragiola/flow-angular/drag";
import { keyboard } from "@fragiola/flow-angular/keyboard";
import {
    FLOW_RESIZE,
    RESIZE_POSITIONS,
    resize,
} from "@fragiola/flow-angular/resize";
import { selection } from "@fragiola/flow-angular/selection";
import { styles } from "./styles";

// `resize()` and `flowNodeResizer`: a handle on each corner and side of the node; dragging one
// resizes the node (`node.resize`, its `width` and `height` written to the document). Each resizer
// has its own limits over the feature's; the photo keeps its aspect ratio, and the banner's resizer
// moves only its width (`direction="horizontal"`), from its two sides. The handles show while the
// node is selected (a style on the node's `data-selected`). With `keyboard()` each handle takes
// focus: Tab to one and use the arrows (Shift for a bigger step); each has its own name, the
// default handles have none.

interface Types extends FlowTypes {
    readonly nodes: {
        note: { label: string; text: string; limits: string };
        photo: { label: string };
        banner: { label: string };
    };
}

const features = [
    selection(),
    drag(),
    resize({ minWidth: 80, minHeight: 60 }),
    keyboard(),
] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "note",
        type: "note",
        position: { x: 0, y: 0 },
        width: 200,
        height: 120,
        selected: true,
        data: {
            label: "Note",
            text: "Resize me from any corner or side.",
            limits: "120–360 × 80–240",
        },
    },
    {
        id: "photo",
        type: "photo",
        position: { x: 260, y: 0 },
        width: 160,
        height: 120,
        data: { label: "Photo (4:3, keeps its ratio)" },
    },
    {
        id: "banner",
        type: "banner",
        position: { x: 0, y: 170 },
        width: 420,
        height: 64,
        data: { label: "Banner (resizes across only)" },
    },
];

/** The two sides a horizontal resizer moves, each named. */
const SIDES = ["left", "right"] as const;

@Component({
    selector: "example-node-resizer",
    imports: [FLOW, FLOW_RESIZE],
    host: { class: "contents" },
    template: `
        <div flowRoot [model]="model" [fitView]="{ padding: 0.2, maxZoom: 1 }" [class]="styles.root">
            <svg flowBackground variant="dots" [size]="2" [class]="styles.dots"></svg>
            <svg flowBackground variant="lines" [class]="styles.lines"></svg>
            <svg flowBackground variant="cross" [class]="styles.cross"></svg>
            <div flowViewport>
                <div flowNodes>
                    <ng-template [flowNodesItem]="model" let-node>
                        <div [flowNode]="node" [attr.aria-label]="node.data.label" [class]="styles.node">
                            <span [class]="styles.title">{{ node.data.label }}</span>
                            @if (node.type === "note") {
                                <p [class]="styles.text">{{ node.data.text }}</p>
                                <span [class]="styles.limits">{{ node.data.limits }}</span>
                                <div
                                    flowNodeResizer
                                    [minWidth]="120"
                                    [maxWidth]="360"
                                    [minHeight]="80"
                                    [maxHeight]="240"
                                    [class]="styles.resizer"
                                >
                                    @for (position of positions; track position) {
                                        <div
                                            flowResizeHandle
                                            [position]="position"
                                            [attr.aria-label]="'Resize ' + node.id + ': ' + position"
                                            [class]="styles.resizeHandle"
                                        ></div>
                                    }
                                </div>
                            } @else if (node.type === "banner") {
                                <div flowNodeResizer direction="horizontal" [class]="styles.resizer">
                                    @for (position of sides; track position) {
                                        <div
                                            flowResizeHandle
                                            [position]="position"
                                            [attr.aria-label]="'Resize ' + node.id + ': ' + position"
                                            [class]="styles.resizeHandle"
                                        ></div>
                                    }
                                </div>
                            } @else {
                                <div role="img" aria-label="A placeholder photo" [class]="styles.photo"></div>
                                <div flowNodeResizer keepAspectRatio [class]="styles.resizer">
                                    @for (position of positions; track position) {
                                        <div
                                            flowResizeHandle
                                            [position]="position"
                                            [attr.aria-label]="'Resize ' + node.id + ': ' + position"
                                            [class]="styles.resizeHandle"
                                        ></div>
                                    }
                                </div>
                            }
                        </div>
                    </ng-template>
                </div>
            </div>
        </div>
    `,
})
export default class NodeResizerExample {
    protected readonly styles = styles;
    protected readonly positions = RESIZE_POSITIONS;
    protected readonly sides = SIDES;
    protected readonly model = createFlowModel<Types, typeof features>(
        { version: 1, nodes, edges: [] },
        { features },
    );
}
