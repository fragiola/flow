import type { EdgePath } from "@fragiola/flow";
import { useEdgeId, useFlowContext } from "../context";
import { sameValue, useFlowValue } from "../hooks/internal";
import { useEdgePath } from "../hooks/use-edge";
import { type SvgPrimitiveProps, useRenderElement } from "../utils/use-render";

export interface ReconnectAnchorState {
    readonly edgeId: string;
    /** which end of the edge it moves */
    readonly end: "source" | "target";
    /** the edge's path and ends */
    readonly path: EdgePath;
    /** this edge's end is being moved */
    readonly reconnecting: boolean;
}

export interface ReconnectAnchorProps
    extends SvgPrimitiveProps<ReconnectAnchorState, SVGCircleElement> {
    /** which end of the edge it moves */
    end: "source" | "target";
    /** the edge; default the enclosing `Flow.Edge`'s */
    edgeId?: string | undefined;
}

/**
 * An edge end's grab area (`data-flow-part="reconnect-anchor"`, `data-end`): an SVG circle at the
 * end, inside `Flow.Edge`. With `reconnection()`, a press on it moves that end to another handle;
 * an end its edge's `reconnectable` keeps fixed (`false`, or the other end's name) draws none.
 * Transparent by default; give it its radius (`r`, default 10) and look.
 */
export function ReconnectAnchor(props: ReconnectAnchorProps) {
    const { edgeId: edgeIdProp, end, ...rest } = props;
    const edgeId = useEdgeId("ReconnectAnchor", edgeIdProp);
    const { model, engine } = useFlowContext("ReconnectAnchor");
    const path = useEdgePath(edgeId);
    const view = useFlowValue(
        model,
        engine,
        () =>
            engine
                ? {
                      attributes: engine.adapter.attributes(
                          "reconnect-anchor",
                          {
                              edgeId,
                              end,
                          },
                      ),
                      reconnecting: engine.is("edge-reconnecting", { edgeId }),
                      // `reconnectable: "source"` (or `"target"`, or false): no anchor at the other end
                      movable: model.is("edge-reconnectable", { edgeId, end }),
                  }
                : undefined,
        sameValue,
        "entity",
        { kind: "edge", id: edgeId },
    );
    if (!path || !view?.movable) return null;
    return (
        <ReconnectAnchorElement
            {...rest}
            state={{ edgeId, end, path, reconnecting: view.reconnecting }}
            attributes={view.attributes}
        />
    );
}

function ReconnectAnchorElement(
    props: Omit<ReconnectAnchorProps, "edgeId" | "end"> & {
        state: ReconnectAnchorState;
        attributes: Readonly<Record<string, string | undefined>>;
    },
) {
    const { state, attributes, ...rest } = props;
    const point = state.path[state.end];
    return useRenderElement("circle", rest, {
        state,
        props: {
            ...attributes,
            cx: point.x,
            cy: point.y,
            r: 10,
            fill: "transparent",
        },
        style: { pointerEvents: "all" },
    });
}
