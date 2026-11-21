import type { Rect } from "@fragiola/flow";
import type * as React from "react";
import { useFlowContext } from "../context";
import { useFlowValue } from "../hooks/internal";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";

export interface SelectionBoxState {
    /** the box, in pixels relative to the root */
    readonly box: Rect;
}

export interface SelectionBoxProps
    extends DivPrimitiveProps<SelectionBoxState> {
    children?: React.ReactNode;
}

/**
 * The box selection being drawn (`data-flow-part="selection-box"`, `selection()`): absolutely
 * positioned in `Flow.Root` (outside `Flow.Viewport`: it is in screen pixels), rendered only
 * while a box is drawn. Give it its look.
 */
export function SelectionBox(props: SelectionBoxProps) {
    const { model, engine } = useFlowContext("SelectionBox");
    const box = useFlowValue(model, engine, () =>
        engine ? engine.get("selection-box") : null,
    );
    if (!box) return null;
    return <SelectionBoxElement {...props} box={box} />;
}

function SelectionBoxElement(props: SelectionBoxProps & { box: Rect }) {
    const { box, children, ...rest } = props;
    const { model, engine } = useFlowContext("SelectionBox");
    const attributes = useFlowValue(
        model,
        engine,
        () => engine?.adapter.attributes("selection-box") ?? {},
    );
    return useRenderElement("div", rest, {
        state: { box },
        props: {
            ...attributes,
            "data-flow-part": "selection-box",
            children,
        },
        style: {
            position: "absolute",
            left: box.x,
            top: box.y,
            width: box.width,
            height: box.height,
            pointerEvents: "none",
        },
    });
}
