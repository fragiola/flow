// The path of an edge (`[flowEdgePath]`, and the one `[flowEdge]` draws when the app writes none):
// its `d` from the engine (`edge-path-by`, D9), unfilled, on an SVG `<path>`.
import { computed, type Signal } from "@angular/core";
import type { EdgePath } from "@fragiola/flow";
import type { FlowContext } from "../context";
import { bindAttributes, bindBaseAttributes } from "../utils/helpers";
import { edgePathOf } from "./inject-edge";
import { flowValue } from "./internal";

export interface EdgePathState {
    readonly edgeId: string;
    /** the edge's path, label point and ends */
    readonly path: EdgePath;
    /** `data-selected` (`selection()`) */
    readonly selected: boolean;
}

/** @internal binds an edge's path onto `element`; returns its state */
export function bindEdgePath(
    context: FlowContext,
    element: SVGElement,
    edgeId: Signal<string | undefined>,
): Signal<EdgePathState | undefined> {
    const path = edgePathOf(context, edgeId);
    const attributes = flowValue(context, () => {
        const id = edgeId();
        return id === undefined
            ? undefined
            : context.engine()?.adapter.attributes("edge-path", { edgeId: id });
    });
    bindAttributes(element, () => attributes() ?? {});
    // the app's own `d` (an app type drawn from `state.path`'s ends) and `fill` win
    bindBaseAttributes(element, () => ({
        d: path()?.path,
        fill: "none",
    }));
    return computed(() => {
        const id = edgeId();
        const current = path();
        const own = attributes();
        if (id === undefined || !current || !own) return undefined;
        return {
            edgeId: id,
            path: current,
            selected: own["data-selected"] !== undefined,
        };
    });
}
