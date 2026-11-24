import { Component, computed, inject, input } from "@angular/core";
import { FLOW, FlowEdgeDirective } from "@fragiola/flow-angular";
import { edgeGradient, gradientId, gradientUrl } from "./gradients";
import { STEPS, type Types } from "./index";
import { styles } from "./styles";

/**
 * An edge stroked with a `<linearGradient>` of its own (on the edge's own group), drawn in flow
 * coordinates between its ends (`flowEdge`'s `state().path`, read here so it follows a drag in
 * this view alone). Both paths are always written: the edge never takes its default one.
 */
@Component({
    selector: "[exampleGradientEdge]",
    imports: [FLOW],
    host: { "[attr.aria-label]": "label()" },
    template: `
        @let drawn = ends();
        <svg:defs>
            <svg:linearGradient
                [attr.id]="id()"
                gradientUnits="userSpaceOnUse"
                [attr.x1]="drawn?.source?.x"
                [attr.y1]="drawn?.source?.y"
                [attr.x2]="drawn?.target?.x"
                [attr.y2]="drawn?.target?.y"
            >
                <svg:stop offset="0%" [class]="styles.stop(gradient().from)" />
                <svg:stop offset="100%" [class]="styles.stop(gradient().to)" />
            </svg:linearGradient>
        </svg:defs>
        <!-- a wide transparent path: a bigger target for a click -->
        <svg:path flowEdgePath [class]="styles.edgeHit" />
        <svg:path flowEdgePath [attr.stroke]="url()" [class]="styles.edge" />
    `,
})
export class GradientEdge {
    /** this flow's gradient id prefix */
    readonly prefix = input.required<string>();
    protected readonly styles = styles;
    private readonly edge = inject<FlowEdgeDirective<Types>>(FlowEdgeDirective);
    protected readonly ends = computed(() => this.edge.state()?.path);
    protected readonly gradient = computed(() => {
        const { source, target } = this.edge.flowEdge();
        return edgeGradient(
            STEPS[source]?.kind ?? "transform",
            STEPS[target]?.kind ?? "transform",
        );
    });
    protected readonly id = computed(() =>
        gradientId(this.prefix(), this.edge.flowEdge().id),
    );
    protected readonly url = computed(() =>
        gradientUrl(this.prefix(), this.edge.flowEdge().id),
    );
    protected readonly label = computed(() => {
        const { source, target } = this.edge.flowEdge();
        return `${STEPS[source]?.label} to ${STEPS[target]?.label}`;
    });
}
