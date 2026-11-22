import {
    type AnyTypes,
    type FlowEdge,
    type FlowTypes,
    partAttributes,
} from "@fragiola/flow";
import * as React from "react";
import { EdgeLabelLayerContext, useFlowContext } from "../context";
import { useFlowValue } from "../hooks/internal";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";

export interface EdgesState {
    /** how many edges are drawn */
    count: number;
}

export interface EdgesProps<T extends FlowTypes = AnyTypes>
    extends Omit<DivPrimitiveProps<EdgesState>, "children"> {
    /**
     * draws one edge: usually a `Flow.Edge` (an SVG group) with its path and label. A new function re-renders every
     * one: keep it stable (a module function, `useCallback`) when the app re-renders on each
     * change (controlled `nodes` / `edges`)
     */
    children: (edge: FlowEdge<T>) => React.ReactNode;
}

const LAYER_STYLE: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    overflow: "visible",
    pointerEvents: "none",
};

interface EdgeSlotProps {
    edge: FlowEdge;
    render: (edge: FlowEdge) => React.ReactNode;
}

// one edge's drawing, again only when its edge (or the children function) changes; its path
// re-renders by itself (`Flow.EdgePath` follows `edge-path-by`)
const EdgeSlot = React.memo(function EdgeSlot({ edge, render }: EdgeSlotProps) {
    return render(edge);
});

/**
 * The layer of the edges (`data-flow-part="edges"`), inside `Flow.Viewport`, before `Flow.Nodes`:
 * an SVG (`data-flow-part="edges"` too) where `children` draws each edge, once both its nodes have
 * a size, in the engine's drawing order (`drawn-edges`: by `zIndex`), and the HTML layer edge
 * labels go to. It lets presses through to the pane; the edges' own parts take them.
 */
export function Edges<T extends FlowTypes = AnyTypes>(props: EdgesProps<T>) {
    const { children, ...rest } = props;
    const { model, engine } = useFlowContext("Edges");
    // the core's drawing order: shown, measured, in view with `onlyRenderVisible`, by z-order
    const list = useFlowValue(model, engine, () =>
        engine ? engine.get("drawn-edges") : [],
    );
    const [layer, setLayer] = React.useState<HTMLElement | null>(null);
    const render = children as unknown as (edge: FlowEdge) => React.ReactNode;
    const element = useRenderElement("div", rest, {
        state: { count: list.length },
        ref: setLayer as React.Ref<Element>,
        props: {
            ...partAttributes("edges"),
            children: (
                // biome-ignore lint/a11y/noSvgWithoutTitle: a layer of edges, not an image: each edge is the consumer's to name
                <svg {...partAttributes("edges")} style={LAYER_STYLE}>
                    {list.map((edge) => (
                        <EdgeSlot key={edge.id} edge={edge} render={render} />
                    ))}
                </svg>
            ),
        },
        style: LAYER_STYLE,
    });
    return (
        <EdgeLabelLayerContext.Provider value={layer}>
            {element}
        </EdgeLabelLayerContext.Provider>
    );
}
