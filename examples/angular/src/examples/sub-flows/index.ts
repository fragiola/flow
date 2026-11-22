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
import { subflows } from "@fragiola/flow-angular/subflows";
import { DropIntoGroups } from "./drop-into-groups";
import { styles } from "./styles";

// `subflows()` gives a node a parent (`parentId`): its position is relative to the parent, it moves
// with it, and with `extent: "parent"` it stays inside it. Nodes are rendered flat (a child is not
// inside its parent's element), each at its absolute place. Drop a loose node onto a group and the
// app puts it in with `node.set-parent`, which keeps it where it is on screen. With
// `zIndexMode="auto"` (the default, written here to show it) an edge with an end in a group is
// drawn at its ends' level: above the groups it crosses, under the nodes it joins; a selected edge
// rises above every node. `"basic"` keeps every edge under every node, and `"manual"` follows only
// the `zIndex` values.

export interface Types extends FlowTypes {
    readonly nodes: {
        group: { label: string };
        item: { label: string };
    };
}

export const features = [selection(), drag(), subflows()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "frontend",
        type: "group",
        position: { x: 0, y: 0 },
        width: 260,
        height: 220,
        data: { label: "Frontend" },
    },
    {
        id: "ui",
        type: "item",
        parentId: "frontend",
        extent: "parent",
        position: { x: 20, y: 50 },
        data: { label: "UI" },
    },
    {
        id: "state",
        type: "item",
        parentId: "frontend",
        extent: "parent",
        position: { x: 110, y: 140 },
        data: { label: "State" },
    },
    {
        id: "backend",
        type: "group",
        position: { x: 340, y: 0 },
        width: 260,
        height: 220,
        data: { label: "Backend" },
    },
    {
        id: "api",
        type: "item",
        parentId: "backend",
        extent: "parent",
        position: { x: 30, y: 60 },
        data: { label: "API" },
    },
    {
        id: "cache",
        type: "item",
        position: { x: 180, y: 280 },
        data: { label: "Cache (drop me in a group)" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "ui-state", source: "ui", target: "state" },
    { id: "state-api", source: "state", target: "api" },
];

@Component({
    selector: "example-sub-flows",
    imports: [FLOW, DropIntoGroups],
    host: { class: "contents" },
    template: `
        <div flowRoot [model]="model" [fitView]="{ padding: 0.2, maxZoom: 1 }" zIndexMode="auto" [class]="styles.root">
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
                        @if (node.type === "group") {
                            <div [flowNode]="node" [class]="styles.group">
                                <span [class]="styles.groupTitle">{{ node.data.label }}</span>
                            </div>
                        } @else {
                            <div [flowNode]="node" [class]="styles.node">
                                {{ node.data.label }}
                                <div flowHandle type="target" side="top" [class]="styles.handle"></div>
                                <div flowHandle type="source" side="bottom" [class]="styles.handle"></div>
                            </div>
                        }
                    </ng-template>
                </div>
            </div>
            <example-sub-flows-drop-into-groups />
        </div>
    `,
})
export default class SubFlows {
    protected readonly styles = styles;
    protected readonly model = createFlowModel<Types, typeof features>(
        { version: 1, nodes, edges },
        { features },
    );
}
