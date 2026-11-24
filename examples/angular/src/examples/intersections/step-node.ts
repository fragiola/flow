import { Component, inject } from "@angular/core";
import {
    FLOW,
    FlowNodeDirective,
    injectFlowStore,
} from "@fragiola/flow-angular";
import type { features, Types } from "./index";
import { styles } from "./styles";

/** A node, marked while a dragged node overlaps it (on the node's own element). */
@Component({
    selector: "[exampleStepNode]",
    imports: [FLOW],
    host: { "[attr.data-intersecting]": "intersecting() ? '' : null" },
    template: `
        <div flowHandle type="target" side="left" [class]="styles.handle"></div>
        {{ node.flowNode().data.label }}
        <div flowHandle type="source" side="right" [class]="styles.handle"></div>
    `,
})
export class StepNode {
    protected readonly styles = styles;
    protected readonly node =
        inject<FlowNodeDirective<Types>>(FlowNodeDirective);
    protected readonly intersecting = injectFlowStore<
        boolean,
        Types,
        typeof features
    >(({ engine }) => {
        const nodeId = this.node.flowNode().id;
        const dragging = engine.get("dragging-node-ids");
        if (dragging.length === 0 || dragging.includes(nodeId)) return false;
        return engine
            .get("intersecting-nodes", { nodeId })
            .some((other) => dragging.includes(other.id));
    });
}
