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
import { NumberBody } from "./number-body";
import { styles } from "./styles";
import { SumBody } from "./sum-body";

// A node that computes from its inputs: the sum node reads the connections that end at it
// (`injectNodeConnections`) and their source nodes' data (`injectNodesData`), so it follows a
// value changed with the steppers and an edge connected or removed, and updates only then (a drag
// of another node does not touch it). Connect the third number to the sum to add it.

export interface Types extends FlowTypes {
    readonly nodes: {
        number: { label: string; value: number };
        sum: { label: string };
    };
}

export type Node = FlowNode<Types>;

export const features = [selection(), drag(), connection()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "a",
        type: "number",
        position: { x: 0, y: 0 },
        data: { label: "A", value: 3 },
    },
    {
        id: "b",
        type: "number",
        position: { x: 0, y: 130 },
        data: { label: "B", value: 5 },
    },
    {
        id: "c",
        type: "number",
        position: { x: 0, y: 260 },
        data: { label: "C", value: 8 },
    },
    {
        id: "sum",
        type: "sum",
        position: { x: 300, y: 110 },
        data: { label: "Sum" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "a-sum", source: "a", target: "sum" },
    { id: "b-sum", source: "b", target: "sum" },
];

@Component({
    selector: "example-connected-data",
    imports: [FLOW, NumberBody, SumBody],
    host: { class: "contents" },
    template: `
        <div flowRoot [model]="model" [fitView]="{ padding: 0.2, maxZoom: 1 }" role="group" aria-label="A sum of numbers" [class]="styles.root">
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
                        <div
                            [flowNode]="node"
                            role="group"
                            aria-roledescription="node"
                            [attr.aria-label]="node.data.label"
                            [class]="styles.node"
                        >
                            @if (node.type === "number") {
                                <example-connected-data-number [node]="node" />
                                <div
                                    flowHandle
                                    type="source"
                                    side="right"
                                    [attr.aria-label]="node.data.label + ' output'"
                                    [class]="styles.handle"
                                ></div>
                            } @else {
                                <example-connected-data-sum />
                                <div
                                    flowHandle
                                    type="target"
                                    side="left"
                                    aria-label="Sum input"
                                    [class]="styles.handle"
                                ></div>
                            }
                        </div>
                    </ng-template>
                </div>
                <svg flowConnectionLine [class]="styles.connection"></svg>
            </div>
            <p [class]="styles.hint">Change a number, or connect C to the sum</p>
        </div>
    `,
})
export default class ConnectedData {
    protected readonly styles = styles;
    protected readonly model = createFlowModel<Types, typeof features>(
        { version: 1, nodes, edges },
        { features },
    );
}
