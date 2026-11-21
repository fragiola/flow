import { Directive, input, type Signal } from "@angular/core";
import { injectEdgeContext, injectFlowContext } from "../context";
import { bindEdgePath, type EdgePathState } from "../inject/bind-edge-path";
import { partOwnerId } from "../inject/internal";
import { injectHost } from "../utils/helpers";

export type { EdgePathState } from "../inject/bind-edge-path";

/**
 * An edge's path (`data-flow-part="edge-path"`), on the app's SVG `<path>` inside `[flowEdge]`:
 * `<svg:path flowEdgePath />`. Its `d` is the engine's (`edge-path-by`, D9) and it is unfilled;
 * a `d` (or a `fill`) of the app's own wins: an app type is drawn from `state().path`'s ends.
 * Several may share an edge: a wide transparent one is a bigger press target.
 */
@Directive({ selector: "[flowEdgePath]", exportAs: "flowEdgePath" })
export class FlowEdgePathDirective {
    /** the edge; default the enclosing `[flowEdge]`'s */
    readonly edgeId = input<string | undefined>(undefined);

    /** the path's state (`undefined` until the edge has a path) */
    readonly state: Signal<EdgePathState | undefined> = bindEdgePath(
        injectFlowContext("[flowEdgePath]"),
        injectHost<SVGElement>(),
        partOwnerId("[flowEdgePath]", this.edgeId, injectEdgeContext(), "edge"),
    );
}
