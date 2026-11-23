import type { EdgePath } from "@fragiola/flow";
import * as React from "react";
import { createPortal } from "react-dom";
import { EdgeLabelLayerContext, useEdgeId, useFlowContext } from "../context";
import { sameValue, useFlowValue } from "../hooks/internal";
import { staticEdgeAttributes, useEdgePath } from "../hooks/use-edge";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";

export interface EdgeLabelState {
    readonly edgeId: string;
    /** the edge's path, label point and ends */
    readonly path: EdgePath;
    /** `data-selected` (`selection()`) */
    readonly selected: boolean;
}

export interface EdgeLabelProps extends DivPrimitiveProps<EdgeLabelState> {
    /** the edge; default the enclosing `Flow.Edge`'s */
    edgeId?: string | undefined;
    children?: React.ReactNode;
}

/**
 * An edge's label (`data-flow-part="edge-label"`): HTML, centred on the path's label point in
 * flow coordinates, in the HTML layer of `Flow.Edges` (a portal: SVG holds no HTML). It renders
 * only its children; a press on it selects its edge.
 */
export function EdgeLabel(props: EdgeLabelProps) {
    const { edgeId: edgeIdProp, ...rest } = props;
    const edgeId = useEdgeId("EdgeLabel", edgeIdProp);
    const layer = React.useContext(EdgeLabelLayerContext);
    const { model, engine } = useFlowContext("EdgeLabel");
    const path = useEdgePath(edgeId);
    const attributes = useFlowValue(
        model,
        engine,
        () =>
            engine
                ? engine.adapter.attributes("edge-label", { edgeId })
                : staticEdgeAttributes(
                      "edge-label",
                      model.get("edge-by", { id: edgeId }) ?? { id: edgeId },
                  ),
        sameValue,
        "entity",
        { kind: "edge", id: edgeId },
    );
    if (!path || !attributes || !layer) return null;
    return createPortal(
        <EdgeLabelElement
            {...rest}
            state={{
                edgeId,
                path,
                selected: attributes["data-selected"] !== undefined,
            }}
            attributes={attributes}
        />,
        layer,
    );
}

function EdgeLabelElement(
    props: Omit<EdgeLabelProps, "edgeId"> & {
        state: EdgeLabelState;
        attributes: Readonly<Record<string, string | undefined>>;
    },
) {
    const { state, attributes, children, ...rest } = props;
    const { x, y } = state.path.label;
    return useRenderElement("div", rest, {
        state,
        props: { ...attributes, children },
        style: {
            position: "absolute",
            top: 0,
            left: 0,
            transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
            pointerEvents: "all",
        },
    });
}
