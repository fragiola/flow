import { computed, Directive, input, type Signal } from "@angular/core";
import type { EdgePath } from "@fragiola/flow";
import { injectEdgeContext, injectFlowContext } from "../context";
import { edgePathOf } from "../inject/inject-edge";
import { entityOf, flowValue, partOwnerId } from "../inject/internal";
import {
    beforeInputs,
    bindAttributes,
    bindBaseAttributes,
    bindStructuralStyle,
    injectHost,
} from "../utils/helpers";
import { bindPresence } from "../utils/presence";

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
 * With `reconnection()`, a press on it moves that end to another handle; an end its edge's
 * `reconnectable` keeps fixed (`false`, or the other end's name) has none: the element leaves the
 * document meanwhile. Transparent by default; give it its radius (`r`, default 10) and look.
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
    /**
     * this end may move (`edge-reconnectable`): `reconnectable: "source"` (or `"target"`, or
     * false) keeps the other end fixed, which draws no anchor
     */
    private readonly movable = flowValue(
        this.context,
        () => {
            const edgeId = this.id();
            const end = beforeInputs(undefined, this.end);
            if (edgeId === undefined || !end) return true;
            return this.context
                .model()
                .is("edge-reconnectable", { edgeId, end });
        },
        undefined,
        {
            scope: "entity",
            entity: entityOf("edge", () => this.id()),
        },
    );
    private readonly view = flowValue(
        this.context,
        () => {
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
        },
        undefined,
        {
            scope: "entity",
            entity: entityOf("edge", () => this.id()),
        },
    );

    /** the anchor's state (`undefined` while its edge has no path, or its end may not move) */
    readonly state: Signal<ReconnectAnchorState | undefined> = computed(() => {
        const edgeId = this.id();
        const path = this.path();
        const view = this.view();
        if (edgeId === undefined || !path || !view || !this.movable()) {
            return undefined;
        }
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
        bindPresence(host, () => (this.movable() ? "here" : null));
    }
}
