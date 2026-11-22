import { Component } from "@angular/core";
import {
    createFlowModel,
    FLOW,
    type FlowEdgeInput,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-angular";
import { drag } from "@fragiola/flow-angular/drag";
import { selection } from "@fragiola/flow-angular/selection";
import { styles } from "./styles";

// Before the engine exists (on the server, and in the first render in the browser) nothing is
// measured, so the parts draw the document's static geometry: a node at its place, an edge between
// two nodes whose size is known. A node's `width` and `height` fix its size, and its `handles`
// declare where its edges end (a box relative to the node's top-left corner; its centre is the
// end), so these edges are in the server's HTML, and once measured nothing moves. A node with only
// `initialWidth` / `initialHeight` uses them until it is measured, and `targetPosition` is the side
// of its edges' end while no handle gives one. A node's own `origin` places it by another point of
// its box than the root's `nodeOrigin` (here its top centre). Each node renders the handles it
// declares, and draws its frame inside its element, so a handle sits exactly on the node's side.

export interface Types extends FlowTypes {
    readonly nodes: { step: { label: string } };
}

export const features = [selection(), drag()] as const;

const WIDTH = 150;
const HEIGHT = 56;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "request",
        type: "step",
        position: { x: 0, y: 0 },
        width: WIDTH,
        height: HEIGHT,
        handles: [
            { type: "source", position: "right", x: WIDTH, y: HEIGHT / 2 },
        ],
        data: { label: "Page request" },
    },
    {
        id: "render",
        type: "step",
        position: { x: 220, y: 0 },
        width: WIDTH,
        height: HEIGHT,
        handles: [
            { type: "target", position: "left", x: 0, y: HEIGHT / 2 },
            { type: "source", position: "right", x: WIDTH, y: HEIGHT / 2 },
        ],
        data: { label: "Server render" },
    },
    {
        id: "html",
        type: "step",
        position: { x: 440, y: 0 },
        width: WIDTH,
        height: HEIGHT,
        handles: [
            { type: "target", position: "left", x: 0, y: HEIGHT / 2 },
            { type: "source", position: "bottom", x: WIDTH / 2, y: HEIGHT },
        ],
        data: { label: "HTML with edges" },
    },
    {
        // placed by its top centre: right under the HTML node's bottom handle
        id: "hydrate",
        type: "step",
        position: { x: 440 + WIDTH / 2, y: 120 },
        origin: { x: 0.5, y: 0 },
        width: WIDTH,
        height: HEIGHT,
        handles: [
            { type: "target", position: "top", x: WIDTH / 2, y: 0 },
            { type: "source", position: "left", x: 0, y: HEIGHT / 2 },
        ],
        data: { label: "Hydrate" },
    },
    {
        // sized by its content once measured; until then by its initial size
        id: "measure",
        type: "step",
        position: { x: 220, y: 120 },
        initialWidth: WIDTH,
        initialHeight: HEIGHT,
        targetPosition: "right",
        data: { label: "Engine measures" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "request-render", source: "request", target: "render" },
    { id: "render-html", source: "render", target: "html" },
    { id: "html-hydrate", source: "html", target: "hydrate" },
    {
        id: "hydrate-measure",
        source: "hydrate",
        target: "measure",
        type: "smoothstep",
    },
];

@Component({
    selector: "example-server-rendering",
    imports: [FLOW],
    host: { class: "contents" },
    template: `
        <div flowRoot [model]="model" [fitView]="{ padding: 0.15, maxZoom: 1 }" [class]="styles.root">
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
                    <!-- each node renders the handles it declares, or one on its targetPosition side -->
                    <ng-template [flowNodesItem]="model" let-node>
                        <div [flowNode]="node" [class]="styles.node">
                            <div [class]="styles.card">{{ node.data.label }}</div>
                            @for (declared of node.handles ?? []; track declared.type) {
                                <div flowHandle [type]="declared.type" [side]="declared.position" [class]="styles.handle"></div>
                            }
                            @if (!node.handles && node.targetPosition) {
                                <div flowHandle type="target" [side]="node.targetPosition" [class]="styles.handle"></div>
                            }
                        </div>
                    </ng-template>
                </div>
            </div>
        </div>
    `,
})
export default class ServerRendering {
    protected readonly styles = styles;
    protected readonly model = createFlowModel<Types, typeof features>(
        { version: 1, nodes, edges },
        { features },
    );
}
