import type { AnyTypes, FlowEdge, FlowTypes } from "@fragiola/flow";
import * as React from "react";
import { EdgeContext } from "../context";
import { type EdgeState, useEdge } from "../hooks/use-edge";
import { type SvgPrimitiveProps, useRenderElement } from "../utils/use-render";
import { EdgePath } from "./edge-path";

export interface EdgeProps<T extends FlowTypes = AnyTypes>
    extends SvgPrimitiveProps<EdgeState<T>, SVGGElement> {
    /** the edge it draws: the one `Flow.Edges` gives its children function */
    edge: FlowEdge<T>;
    /** its parts: default a `Flow.EdgePath` */
    children?: React.ReactNode;
}

const EDGE_STYLE: React.CSSProperties = { pointerEvents: "visibleStroke" };

/**
 * One edge (`data-flow-part="edge"`, `data-flow-id`): an SVG group inside `Flow.Edges`, drawn once
 * both its nodes have a size. It renders its children (`Flow.EdgePath` by default,
 * `Flow.EdgeLabel`, `Flow.ReconnectAnchor`); a press on its stroke selects it (`selection()`).
 */
export function Edge<T extends FlowTypes = AnyTypes>(props: EdgeProps<T>) {
    const { edge, children, ...rest } = props;
    const { state, props: own } = useEdge<T>(edge);
    const context = React.useMemo(() => ({ edgeId: edge.id }), [edge.id]);
    const element = useRenderElement("g", rest, {
        state,
        props: { ...own, children: children ?? <EdgePath /> },
        style: EDGE_STYLE,
    });
    if (!state.path) return null;
    return (
        <EdgeContext.Provider value={context}>{element}</EdgeContext.Provider>
    );
}
