import type { EdgePath as EdgePathValue } from "@fragiola/flow";
import { useEdgeId, useFlowContext } from "../context";
import { useFlowValue } from "../hooks/internal";
import { useEdgePath } from "../hooks/use-edge";
import { type SvgPrimitiveProps, useRenderElement } from "../utils/use-render";

export interface EdgePathState {
    readonly edgeId: string;
    /** the edge's path, label point and ends */
    readonly path: EdgePathValue;
    /** `data-selected` (`selection()`) */
    readonly selected: boolean;
}

export interface EdgePathProps
    extends SvgPrimitiveProps<EdgePathState, SVGPathElement> {
    /** the edge; default the enclosing `Flow.Edge`'s */
    edgeId?: string | undefined;
}

/**
 * An edge's path (`data-flow-part="edge-path"`): an SVG `<path>` whose `d` is the engine's
 * (`edge-path-by`, D9), unfilled. A `d` of your own draws an app type (from `state.path`'s ends).
 * Several may share an edge: a wide transparent one is a bigger press target.
 */
export function EdgePath(props: EdgePathProps) {
    const { edgeId: edgeIdProp, ...rest } = props;
    const edgeId = useEdgeId("EdgePath", edgeIdProp);
    const { model, engine } = useFlowContext("EdgePath");
    const path = useEdgePath(edgeId);
    const attributes = useFlowValue(model, engine, () =>
        engine?.adapter.attributes("edge-path", { edgeId }),
    );
    if (!path || !attributes) return null;
    return (
        <EdgePathElement
            {...rest}
            state={{
                edgeId,
                path,
                selected: attributes["data-selected"] !== undefined,
            }}
            attributes={attributes}
        />
    );
}

function EdgePathElement(
    props: Omit<EdgePathProps, "edgeId"> & {
        state: EdgePathState;
        attributes: Readonly<Record<string, string | undefined>>;
    },
) {
    const { state, attributes, ...rest } = props;
    return useRenderElement("path", rest, {
        state,
        props: { ...attributes, d: state.path.path, fill: "none" },
    });
}
