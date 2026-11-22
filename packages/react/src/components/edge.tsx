import type { AnyTypes, FlowEdge, FlowTypes } from "@fragiola/flow";
import * as React from "react";
import { EdgeContext, useFlowContext } from "../context";
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
    const { engine } = useFlowContext("Edge");
    const context = React.useMemo(() => ({ edgeId: edge.id }), [edge.id]);
    // an edge that moved to another render level's SVG is a new element: the one that had focus
    // takes it back (`adapter.refocus` does nothing otherwise)
    const ref = React.useCallback(
        (element: Element | null) => {
            if (engine && element) engine.adapter.refocus(element);
        },
        [engine],
    );
    const element = useRenderElement("g", rest, {
        state,
        ref,
        props: { ...own, children: children ?? <EdgePath /> },
        style: EDGE_STYLE,
    });
    if (!state.path) return null;
    return (
        <EdgeContext.Provider value={context}>{element}</EdgeContext.Provider>
    );
}
