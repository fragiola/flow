import { Component, computed, inject } from "@angular/core";
import {
    FLOW,
    FlowEdgeDirective,
    injectInternalNode,
    straightPath,
} from "@fragiola/flow-angular";
import { labelOf, type Types } from "./index";
import { styles } from "./styles";

/** A box's centre. */
const centre = (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
}) => ({
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
});

/**
 * An edge from centre to centre (no handles: a force layout has no sides), under the nodes, on the
 * edge's own group. Both nodes' boxes are `injectInternalNode` signals, followed while they move,
 * so a tick or a drag step redraws this view alone. The path is always written (the edge never
 * takes its default one); its `d` comes once both boxes are measured.
 */
@Component({
    selector: "[exampleCentreEdge]",
    imports: [FLOW],
    host: { "[attr.aria-label]": "label()" },
    template: `<svg:path flowEdgePath [attr.d]="path()" [class]="styles.edge" />`,
})
export class CentreEdge {
    protected readonly styles = styles;
    private readonly edge = inject<FlowEdgeDirective<Types>>(FlowEdgeDirective);
    // both nodes' boxes, followed while they move
    private readonly source = injectInternalNode<Types>(
        () => this.edge.flowEdge().source,
    );
    private readonly target = injectInternalNode<Types>(
        () => this.edge.flowEdge().target,
    );
    protected readonly path = computed(() => {
        const source = this.source();
        const target = this.target();
        return source?.measured && target?.measured
            ? straightPath({
                  source: centre(source.rect),
                  target: centre(target.rect),
              }).path
            : undefined;
    });
    protected readonly label = computed(() => {
        const { source, target } = this.edge.flowEdge();
        return `${labelOf(source)} to ${labelOf(target)}`;
    });
}
