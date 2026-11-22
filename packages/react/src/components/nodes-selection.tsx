import type { Rect } from "@fragiola/flow";
import type * as React from "react";
import { useFlowContext } from "../context";
import { useFlowValue } from "../hooks/internal";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";

export interface NodesSelectionState {
    /** the rectangle around the selected nodes, in flow coordinates */
    readonly rect: Rect;
    /** the selection is being dragged by it: `data-dragging` */
    readonly dragging: boolean;
}

export interface NodesSelectionProps
    extends DivPrimitiveProps<NodesSelectionState> {
    children?: React.ReactNode;
}

/**
 * The rectangle around the selected nodes (`data-flow-part="nodes-selection"`, `selection()`),
 * inside `Flow.Viewport` next to `Flow.Nodes` (it is in flow coordinates): rendered at
 * `selection-rect`, while two or more nodes are selected by a box (or always, with
 * `selection({ rect: "always" })`). A press on it drags the selection (`drag()`), its context
 * menu is the selection's. Give it its look.
 */
export function NodesSelection(props: NodesSelectionProps) {
    const { model, engine } = useFlowContext("NodesSelection");
    const rect = useFlowValue(model, engine, () =>
        engine ? (engine.get("selection-rect") ?? null) : null,
    );
    if (!rect) return null;
    return <NodesSelectionElement {...props} rect={rect} />;
}

function NodesSelectionElement(props: NodesSelectionProps & { rect: Rect }) {
    const { rect, children, ...rest } = props;
    const { model, engine } = useFlowContext("NodesSelection");
    const attributes = useFlowValue(
        model,
        engine,
        () => engine?.adapter.attributes("nodes-selection") ?? {},
    );
    return useRenderElement("div", rest, {
        state: { rect, dragging: attributes["data-dragging"] !== undefined },
        props: { ...attributes, "data-flow-part": "nodes-selection", children },
        style: {
            position: "absolute",
            top: 0,
            left: 0,
            transform: `translate(${rect.x}px, ${rect.y}px)`,
            width: rect.width,
            height: rect.height,
        },
    });
}
