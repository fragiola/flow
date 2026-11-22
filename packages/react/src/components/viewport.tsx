import { partAttributes, type Viewport as ViewportValue } from "@fragiola/flow";
import * as React from "react";
import { useFlowContext } from "../context";
import { useViewport } from "../hooks/use-viewport";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";

export interface ViewportState {
    /** the viewport: the pan (`x`, `y`, pixels) and the zoom */
    viewport: ViewportValue;
}

export interface ViewportProps extends DivPrimitiveProps<ViewportState> {
    children?: React.ReactNode;
}

const VIEWPORT_STYLE: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    // a stacking context of its own before the engine writes its transform (the server's HTML):
    // with several render levels the nodes and edge layers have negative z-indexes
    isolation: "isolate",
};

/**
 * The pannable, zoomable layer (`data-flow-part="viewport"`): what is inside is in flow
 * coordinates (`Flow.Edges`, `Flow.Nodes`, `Flow.ConnectionLine`). The engine writes its
 * `transform` itself (D4), never React: a pan or a zoom re-renders nothing inside it.
 */
export function Viewport(props: ViewportProps) {
    const { children, ...rest } = props;
    const { engine } = useFlowContext("Viewport");
    const viewport = useViewport();
    const ref = React.useCallback(
        (element: HTMLElement | null) => {
            if (!engine) return;
            engine.adapter.attachViewport(element);
            return () => engine.adapter.attachViewport(null);
        },
        [engine],
    );
    return useRenderElement("div", rest, {
        state: { viewport },
        ref: ref as React.Ref<Element>,
        props: { ...partAttributes("viewport"), children },
        style: VIEWPORT_STYLE,
    });
}
