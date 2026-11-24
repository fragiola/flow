import { Component, computed, inject } from "@angular/core";
import { FLOW, FlowEdgeDirective } from "@fragiola/flow-angular";
import { floatingLine } from "./floating-edge";
import { NODE, type Types } from "./index";
import { styles } from "./styles";

// A floating edge: a line from border to border, between the two nodes' centres. It sits on the
// edge's own group (`<svg:g [flowEdge]="edge" exampleFloatingEdge>`) and reads its path from that
// `[flowEdge]`, so a drag step checks this view alone. Its paths are always there (the group
// keeps its own children, never the default path), drawn once both ends are known: an app's `d`
// wins over the engine's. (`floating-edge.ts` is the framework-free line, hence this file's name.)
@Component({
    selector: "[exampleFloatingEdge]",
    imports: [FLOW],
    template: `
        <!-- a wide transparent path: a bigger target for a tap -->
        <svg:path flowEdgePath [attr.d]="path()" [class]="styles.edgeHit" />
        <svg:path flowEdgePath [attr.d]="path()" [class]="styles.edge" />
    `,
})
export class FloatingEdge {
    protected readonly styles = styles;
    private readonly edge = inject<FlowEdgeDirective<Types>>(FlowEdgeDirective);

    /** The line cut at both nodes' borders, once the edge has its ends. */
    protected readonly path = computed(() => {
        const ends = this.edge.state()?.path;
        return ends
            ? floatingLine(ends.source, ends.target, NODE).path
            : undefined;
    });
}
