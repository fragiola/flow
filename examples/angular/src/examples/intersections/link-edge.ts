import { Component, inject } from "@angular/core";
import {
    FLOW,
    FlowEdgeDirective,
    injectFlowStore,
} from "@fragiola/flow-angular";
import { pathCrossesBox } from "./crossing";
import type { features, Types } from "./index";
import { styles } from "./styles";

/** An edge, marked while its path crosses a dragged node that is not one of its ends. */
@Component({
    selector: "[exampleLinkEdge]",
    imports: [FLOW],
    host: { "[attr.data-intersecting]": "intersecting() ? '' : null" },
    template: `<svg:path flowEdgePath [class]="styles.edge" />`,
})
export class LinkEdge {
    protected readonly styles = styles;
    private readonly edge = inject<FlowEdgeDirective<Types>>(FlowEdgeDirective);
    protected readonly intersecting = injectFlowStore<
        boolean,
        Types,
        typeof features
    >(({ engine }) => {
        const { id, source, target } = this.edge.flowEdge();
        const dragging = engine
            .get("dragging-node-ids")
            .filter((nodeId) => nodeId !== source && nodeId !== target);
        if (dragging.length === 0) return false;
        const drawn = engine.get("edge-path-by", { edgeId: id });
        if (!drawn) return false;
        return dragging.some((nodeId) => {
            const box = engine.get("node-rect-by", { nodeId });
            return box !== undefined && box.width > 0
                ? pathCrossesBox(drawn.path, box)
                : false;
        });
    });
}
