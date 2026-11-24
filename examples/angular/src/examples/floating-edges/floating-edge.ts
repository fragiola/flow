import { Component, computed, inject, input } from "@angular/core";
import {
    bezierPath,
    FLOW,
    FlowEdgeDirective,
    type InternalNode,
    injectInternalNode,
    straightPath,
} from "@fragiola/flow-angular";
import {
    type Box,
    type Ends,
    floatingEnds,
    simpleEnds,
} from "./border-intersection";
import { LABELS, type Types, type Variant } from "./index";
import { styles } from "./styles";

/** A node's box as the engine places it, with its shape: what the border geometry reads. */
function boxOf(node: InternalNode<Types>): Box {
    return { ...node.rect, shape: node.node.data.shape };
}

/** The path of a variant between two nodes. */
function floatingPath(variant: Variant, source: Box, target: Box) {
    if (variant === "simple") {
        const ends = simpleEnds(source, target);
        return { ends, path: bezierPath(ends).path };
    }
    const ends: Ends = floatingEnds(source, target);
    const path =
        variant === "bezier" ? bezierPath(ends).path : straightPath(ends).path;
    return { ends, path };
}

/**
 * An edge with no handle (on the edge's own group): drawn between its two nodes' borders, in the
 * variant picked above the flow. Both nodes' boxes are `injectInternalNode` signals, followed
 * while they move, so a drag step redraws this view alone. Both paths are always written (the
 * edge never takes its default one); their `d` comes once both boxes are measured.
 */
@Component({
    selector: "[exampleFloatingEdge]",
    imports: [FLOW],
    host: {
        "[attr.aria-label]": "label()",
        "[attr.data-variant]": "variant()",
    },
    template: `
        @let drawn = floating();
        <!-- a wide transparent path: a bigger target for a click -->
        <svg:path flowEdgePath [attr.d]="drawn?.path" [class]="styles.edgeHit" />
        <svg:path flowEdgePath [attr.d]="drawn?.path" [class]="styles.edge" />
        @if (drawn) {
            <!-- where the edge meets each border -->
            <svg:circle
                [attr.cx]="drawn.ends.source.x"
                [attr.cy]="drawn.ends.source.y"
                r="3"
                [class]="styles.end"
            />
            <svg:circle
                [attr.cx]="drawn.ends.target.x"
                [attr.cy]="drawn.ends.target.y"
                r="3"
                [class]="styles.end"
            />
        }
    `,
})
export class FloatingEdge {
    readonly variant = input.required<Variant>();
    protected readonly styles = styles;
    private readonly edge = inject<FlowEdgeDirective<Types>>(FlowEdgeDirective);
    // both nodes' boxes, followed while they move
    private readonly source = injectInternalNode<Types>(
        () => this.edge.flowEdge().source,
    );
    private readonly target = injectInternalNode<Types>(
        () => this.edge.flowEdge().target,
    );
    protected readonly floating = computed(() => {
        const source = this.source();
        const target = this.target();
        return source?.measured && target?.measured
            ? floatingPath(this.variant(), boxOf(source), boxOf(target))
            : undefined;
    });
    protected readonly label = computed(() => {
        const { source, target } = this.edge.flowEdge();
        return `${LABELS[source]} to ${LABELS[target]}`;
    });
}
