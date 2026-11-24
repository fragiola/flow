import { Component, computed, inject } from "@angular/core";
import {
    FLOW,
    FlowEdgeDirective,
    injectViewport,
} from "@fragiola/flow-angular";
import { showsLabels } from "./detail";
import type { Types } from "./index";
import { styles } from "./styles";

/**
 * A call between two services (on the edge's own group); its label shows from a zoom of 1, a
 * `computed` over the viewport that changes only when it crosses that zoom.
 */
@Component({
    selector: "[exampleCallEdge]",
    imports: [FLOW],
    template: `
        <svg:path flowEdgePath [class]="styles.edge" />
        @if (labelled()) {
            <xhtml:div flowEdgeLabel [class]="styles.label">{{ text() }}</xhtml:div>
        }
    `,
})
export class CallEdge {
    protected readonly styles = styles;
    private readonly edge = inject<FlowEdgeDirective<Types>>(FlowEdgeDirective);
    private readonly viewport = injectViewport();
    protected readonly labelled = computed(() =>
        showsLabels(this.viewport().zoom),
    );
    protected readonly text = computed(() => {
        const edge = this.edge.flowEdge();
        return edge.type === "call" ? (edge.data?.label ?? "") : "";
    });
}
