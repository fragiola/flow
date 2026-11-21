import { computed, Directive, inject, input, type Signal } from "@angular/core";
import type { AnyTypes, FlowEdge, FlowTypes } from "@fragiola/flow";
import { type EdgeContext, FLOW_EDGE, injectFlowContext } from "../context";
import { bindEdgePath } from "../inject/bind-edge-path";
import { bindEdge, type EdgeState } from "../inject/inject-edge";
import { defaultContent } from "../utils/default-content";
import { beforeInputs, injectHost } from "../utils/helpers";

const SVG = "http://www.w3.org/2000/svg";

/**
 * One edge (`data-flow-part="edge"`, `data-flow-id`), on the app's SVG group inside
 * `<ng-template flowEdgesItem let-edge>`: `<svg:g [flowEdge]="edge">`, drawn once both its nodes
 * have a size. It renders what the app writes inside it (`[flowEdgePath]`, `[flowEdgeLabel]`,
 * `[flowReconnectAnchor]`), and an edge path when the app writes no element; a press on its stroke
 * selects it (`selection()`). Its state is in its `data-*` and in `#e="flowEdge"`.
 */
@Directive({
    selector: "[flowEdge]",
    exportAs: "flowEdge",
    providers: [
        {
            provide: FLOW_EDGE,
            useFactory: (): EdgeContext => inject(FlowEdgeDirective).context,
        },
    ],
})
export class FlowEdgeDirective<T extends FlowTypes = AnyTypes> {
    /** the edge it draws: the one `flowEdgesItem` gives its template */
    readonly flowEdge = input.required<FlowEdge<T>>();

    private readonly edge = computed(
        () =>
            // (read as unknown: TypeScript does not relate `FlowEdge<T>` to itself here)
            beforeInputs<unknown>(undefined, this.flowEdge) as
                | FlowEdge<T>
                | undefined,
    );

    /** @internal what the parts inside it inject */
    readonly context: EdgeContext = {
        edgeId: computed(() => this.edge()?.id),
    };

    /** the edge's state (`undefined` on a binding's first read, before its input is set) */
    readonly state: Signal<EdgeState<T> | undefined>;

    constructor() {
        const flow = injectFlowContext("[flowEdge]");
        const host = injectHost<SVGElement>();
        this.state = bindEdge<T>(flow, host, this.edge).state;
        // React's default child: an edge path
        defaultContent(host, (document) => {
            const path = document.createElementNS(SVG, "path");
            bindEdgePath(flow, path, this.context.edgeId);
            return [path];
        });
    }
}
