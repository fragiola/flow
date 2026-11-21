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
import { selection } from "@fragiola/flow-angular/selection";
import { styles } from "./styles";

// The smallest flow: four nodes and three edges. The root fills its frame (give it a size); the
// background sits behind the viewport, and inside it the edges come before the nodes so the nodes
// are drawn on top. Pan by dragging the canvas, zoom with the wheel or a pinch, drag a node, and
// draw an edge from a node's bottom handle to another node's top handle.

interface Types extends FlowTypes {
    readonly nodes: { step: { label: string } };
}

const features = [selection(), drag(), connection()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "start",
        type: "step",
        position: { x: 0, y: 0 },
        data: { label: "Start" },
    },
    {
        id: "fetch",
        type: "step",
        position: { x: -160, y: 140 },
        data: { label: "Fetch data" },
    },
    {
        id: "parse",
        type: "step",
        position: { x: 160, y: 140 },
        data: { label: "Parse file" },
    },
    {
        id: "save",
        type: "step",
        position: { x: 0, y: 280 },
        data: { label: "Save" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "start-fetch", source: "start", target: "fetch" },
    { id: "start-parse", source: "start", target: "parse" },
    { id: "fetch-save", source: "fetch", target: "save" },
];

@Component({
    selector: "example-basic",
    imports: [FLOW],
    host: { class: "contents" },
    template: `
        <div flowRoot [model]="model" [fitView]="{ padding: 0.2, maxZoom: 1 }" [class]="styles.root">
            <!-- one layer per pattern: the theme shows the one it picks -->
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
                    <ng-template [flowNodesItem]="model" let-node>
                        <div [flowNode]="node" [class]="styles.node">
                            {{ node.data.label }}
                            <div flowHandle type="target" side="top" [class]="styles.handle"></div>
                            <div flowHandle type="source" side="bottom" [class]="styles.handle"></div>
                        </div>
                    </ng-template>
                </div>
                <svg flowConnectionLine [class]="styles.connection"></svg>
            </div>
        </div>
    `,
})
export default class BasicFlow {
    protected readonly styles = styles;
    // the flow's document and features: the model types the templates' nodes and edges
    protected readonly model = createFlowModel<Types, typeof features>(
        { version: 1, nodes, edges },
        { features },
    );
}
