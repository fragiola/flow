import { computed, Directive, input, type Signal } from "@angular/core";
import type { EdgePath } from "@fragiola/flow";
import { injectEdgeContext, injectFlowContext } from "../context";
import { edgePathOf } from "../inject/inject-edge";
import { flowValue, partOwnerId } from "../inject/internal";
import {
    beforeInputs,
    bindAttributes,
    bindBaseAttributes,
    bindStructuralStyle,
    injectHost,
} from "../utils/helpers";

export interface ReconnectAnchorState {
    readonly edgeId: string;
    /** which end of the edge it moves */
    readonly end: "source" | "target";
    /** the edge's path and ends */
    readonly path: EdgePath;
    /** this edge's end is being moved */
    readonly reconnecting: boolean;
}

/**
 * An edge end's grab area (`data-flow-part="reconnect-anchor"`, `data-end`), on the app's SVG
 * circle inside `[flowEdge]`: `<svg:circle flowReconnectAnchor end="target" />`, at that end.
 * With `reconnection()`, a press on it moves that end to another handle. Transparent by default;
 * give it its radius (`r`, default 10) and look.
 */
@Directive({
    selector: "[flowReconnectAnchor]",
    exportAs: "flowReconnectAnchor",
})
export class FlowReconnectAnchorDirective {
    /** which end of the edge it moves */
    readonly end = input.required<"source" | "target">();
    /** the edge; default the enclosing `[flowEdge]`'s */
    readonly edgeId = input<string | undefined>(undefined);

    private readonly context = injectFlowContext("[flowReconnectAnchor]");
    private readonly id = partOwnerId(
        "[flowReconnectAnchor]",
        this.edgeId,
        injectEdgeContext(),
        "edge",
    );
    private readonly path = edgePathOf(this.context, this.id);
    private readonly view = flowValue(this.context, () => {
        const edgeId = this.id();
        const engine = this.context.engine();
        const end = beforeInputs(undefined, this.end);
        if (edgeId === undefined || !engine || !end) return undefined;
        return {
            end,
            attributes: engine.adapter.attributes("reconnect-anchor", {
                edgeId,
                end,
            }),
            reconnecting: engine.is("edge-reconnecting", { edgeId }),
        };
    });

    /** the anchor's state (`undefined` while its edge has no path) */
    readonly state: Signal<ReconnectAnchorState | undefined> = computed(() => {
        const edgeId = this.id();
        const path = this.path();
        const view = this.view();
        if (edgeId === undefined || !path || !view) return undefined;
        return {
            edgeId,
            end: view.end,
            path,
            reconnecting: view.reconnecting,
        };
    });

    constructor() {
        const host = injectHost<SVGElement>();
        bindAttributes(host, () => this.view()?.attributes ?? {});
        bindBaseAttributes(host, () => {
            const state = this.state();
            const point = state ? state.path[state.end] : undefined;
            return {
                cx: point === undefined ? undefined : String(point.x),
                cy: point === undefined ? undefined : String(point.y),
                r: "10",
                fill: "transparent",
            };
        });
        bindStructuralStyle(host, () => ({ pointerEvents: "all" }));
    }
}
