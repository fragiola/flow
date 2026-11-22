import { Component } from "@angular/core";
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
import { selection } from "@fragiola/flow-angular/selection";
import { ColourNode } from "./colour-node";
import { NumberNode } from "./number-node";
import { PreviewNode } from "./preview-node";
import { styles } from "./styles";

// Each node type renders its own content from its typed data. The `Types` registry names the node
// types and their data, so `node.type` narrows `node.data`. The colour and number nodes write their
// data with `node.set-data`; the preview reads the nodes wired into its two target handles. A field
// inside a node keeps its own presses: it never starts a drag. The preview drags only by its title
// bar: an element with `data-flow-drag-handle` makes the rest of its node a press that selects it
// and moves nothing.

export interface Types extends FlowTypes {
    readonly nodes: {
        colour: { label: string; colour: string };
        number: { label: string; value: number };
        preview: { label: string };
    };
}

export type Node = FlowNode<Types>;

export const features = [selection(), drag(), connection()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "colour",
        type: "colour",
        position: { x: 0, y: 0 },
        data: { label: "Colour", colour: "#3b82f6" },
    },
    {
        id: "size",
        type: "number",
        position: { x: 0, y: 160 },
        data: { label: "Size", value: 48 },
    },
    {
        id: "preview",
        type: "preview",
        position: { x: 320, y: 50 },
        data: { label: "Preview" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    {
        id: "colour-preview",
        source: "colour",
        target: "preview",
        targetHandle: "colour",
    },
    {
        id: "size-preview",
        source: "size",
        target: "preview",
        targetHandle: "size",
    },
];

@Component({
    selector: "example-custom-nodes",
    imports: [FLOW, ColourNode, NumberNode, PreviewNode],
    host: { class: "contents" },
    template: `
        <div flowRoot [model]="model" [fitView]="{ padding: 0.2, maxZoom: 1 }" [class]="styles.root">
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
                    <!-- one template for every node: a change renders only the node it touched -->
                    <ng-template [flowNodesItem]="model" let-node>
                        <div [flowNode]="node" [class]="styles.node">
                            @if (node.type === "colour") {
                                <example-custom-nodes-colour [node]="node" />
                            } @else if (node.type === "number") {
                                <example-custom-nodes-number [node]="node" />
                            } @else if (node.type === "preview") {
                                <example-custom-nodes-preview [node]="node" />
                            }
                        </div>
                    </ng-template>
                </div>
                <svg flowConnectionLine [class]="styles.connection"></svg>
            </div>
        </div>
    `,
})
export default class CustomNodes {
    protected readonly styles = styles;
    protected readonly model = createFlowModel<Types, typeof features>(
        { version: 1, nodes, edges },
        { features },
    );
}
