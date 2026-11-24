import { Component } from "@angular/core";
import {
    createFlowModel,
    FLOW,
    type FlowEdge,
    type FlowEdgeInput,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { drag } from "@fragiola/flow-angular/drag";
import { selection } from "@fragiola/flow-angular/selection";
import { ExportToolbar } from "./export-toolbar";
import { styles } from "./styles";

// An image of the flow, built from its document alone: `flowSvg` (flow-svg.ts) runs the core's
// static geometry (`staticGeometry`: node boxes from the declared sizes, edge paths from the path
// helpers) and writes a standalone SVG string, no DOM needed, so a server makes the same file (the
// unit test does, in node). Download SVG saves it; Download PNG draws it on a canvas and saves
// that. The file cannot read the page's CSS variables, so the theme's look is read off the drawn
// parts at click time and passed in as plain colours. The nodes declare their size and handles,
// so the document holds every box and edge end; drag them and export again.

export interface Types extends FlowTypes {
    readonly nodes: { step: { label: string } };
}

export const features = [selection(), drag()] as const;

const WIDTH = 140;
const HEIGHT = 48;

/** A node of the declared size, with an input on the left and an output on the right. */
function step(id: string, label: string, x: number, y: number) {
    return {
        id,
        type: "step",
        position: { x, y },
        width: WIDTH,
        height: HEIGHT,
        handles: [
            { type: "target", position: "left", x: 0, y: HEIGHT / 2 },
            { type: "source", position: "right", x: WIDTH, y: HEIGHT / 2 },
        ],
        data: { label },
    } satisfies FlowNodeInput<Types>;
}

const nodes: FlowNodeInput<Types>[] = [
    step("document", "Document", 0, 80),
    step("geometry", "Static geometry", 200, 0),
    step("paths", "Edge paths", 200, 160),
    step("svg", "SVG <string>", 400, 80),
    step("png", "PNG & canvas", 600, 80),
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "document-geometry", source: "document", target: "geometry" },
    {
        id: "document-paths",
        source: "document",
        target: "paths",
        type: "smoothstep",
    },
    { id: "geometry-svg", source: "geometry", target: "svg", type: "step" },
    { id: "paths-svg", source: "paths", target: "svg" },
    { id: "svg-png", source: "svg", target: "png", type: "straight" },
];

/** An edge's accessible name: "document to geometry". */
const edgeName = (edge: FlowEdge<Types>) => `${edge.source} to ${edge.target}`;

@Component({
    selector: "example-export-image",
    imports: [FLOW, ExportToolbar],
    host: { class: "contents" },
    template: `
        <div
            flowRoot
            [model]="model"
            fitView
            role="group"
            aria-label="Export image"
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
                            [attr.aria-label]="edgeName(edge)"
                        >
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
                            <div data-frame="" [class]="styles.card">{{ node.data.label }}</div>
                            <div flowHandle type="target" side="left" [class]="styles.handle"></div>
                            <div flowHandle type="source" side="right" [class]="styles.handle"></div>
                        </div>
                    </ng-template>
                </div>
            </div>
            <example-export-toolbar />
        </div>
    `,
})
export default class ExportImageExample {
    protected readonly styles = styles;
    protected readonly edgeName = edgeName;
    protected readonly model = createFlowModel<Types, typeof features>(
        { version: 1, nodes, edges },
        { features },
    );
}
