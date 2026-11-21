// A type fixture (checked by ngc's strict templates in `pnpm typecheck`, never rendered): an app
// with no registry and no model binds its untyped lists straight to the root. Its template sees
// the root as a consumer does (`FlowRootDirective<any, any>`), and an edge of any type is taken.
import { Component } from "@angular/core";
import {
    FLOW,
    type FlowEdge,
    type FlowEdgeInput,
    type FlowNode,
    type FlowNodeInput,
} from "@fragiola/flow-angular";

@Component({
    selector: "test-untyped-lists",
    imports: [FLOW],
    template: `
        <div flowRoot [defaultNodes]="defaultNodes" [defaultEdges]="defaultEdges"></div>
        <div flowRoot [(nodes)]="nodes" [(edges)]="edges"></div>
    `,
})
export class UntypedLists {
    readonly defaultNodes: FlowNodeInput[] = [
        { id: "a", type: "task", position: { x: 0, y: 0 }, data: {} },
    ];
    readonly defaultEdges: FlowEdgeInput[] = [
        { source: "a", target: "b", type: "dependency" },
    ];
    nodes: FlowNode[] = [];
    edges: FlowEdge[] = [{ id: "ab", source: "a", target: "b" }];
}
