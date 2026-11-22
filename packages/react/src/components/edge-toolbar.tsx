import type { EdgeToolbarPosition, PartAttributes, XY } from "@fragiola/flow";
import type * as React from "react";
import { createPortal } from "react-dom";
import { useEdgeId, useFlowContext } from "../context";
import { useFlowValue } from "../hooks/internal";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";

export interface EdgeToolbarState {
    readonly edgeId: string;
    /** the point of the edge it stands at */
    readonly position: "label" | "source" | "target";
    /** where it is anchored (its centre), in pixels relative to the root */
    readonly anchor: EdgeToolbarPosition;
}

export interface EdgeToolbarProps extends DivPrimitiveProps<EdgeToolbarState> {
    /** its edge; default the enclosing `Flow.Edge`'s */
    edgeId?: string | undefined;
    /** the point of the edge it stands at: its label point, its source or its target end; default `"label"` */
    position?: "label" | "source" | "target" | undefined;
    /** a screen offset from that point, in pixels; default `{ x: 0, y: 0 }` */
    offset?: XY | undefined;
    /** whether it is shown; default while its edge is selected (`selection()`) */
    open?: boolean | undefined;
    children?: React.ReactNode;
}

/**
 * A toolbar on an edge (`data-flow-part="toolbar"`, `data-flow-id` its edge's id), outside the
 * zoom: rendered in `Flow.Root` (a portal), centred at the point `edge-toolbar-by` gives (the
 * edge's label point or one of its ends), so it keeps its size at any zoom. Presses and the wheel
 * over it are left to it. It renders only its children (your buttons).
 */
export function EdgeToolbar(props: EdgeToolbarProps) {
    const {
        edgeId: edgeIdProp,
        position = "label",
        offset,
        open,
        ...rest
    } = props;
    const edgeId = useEdgeId("EdgeToolbar", edgeIdProp);
    const { model, engine, rootElement } = useFlowContext("EdgeToolbar");
    const view = useFlowValue(model, engine, () => {
        if (!engine) return undefined;
        const anchor = engine.get("edge-toolbar-by", {
            edgeId,
            position,
            offset,
        });
        return anchor
            ? {
                  anchor,
                  attributes: engine.adapter.attributes("toolbar", { edgeId }),
                  selected: model.is("edge-selected", { edgeId }),
              }
            : undefined;
    });
    const shown = open ?? view?.selected ?? false;
    if (!view || !shown || !rootElement) return null;
    return createPortal(
        <EdgeToolbarElement
            {...rest}
            state={{ edgeId, position, anchor: view.anchor }}
            attributes={view.attributes}
        />,
        rootElement,
    );
}

function EdgeToolbarElement(
    props: Omit<EdgeToolbarProps, "edgeId" | "position" | "offset" | "open"> & {
        state: EdgeToolbarState;
        attributes: PartAttributes;
    },
) {
    const { state, attributes, children, ...rest } = props;
    const { x, y, anchorX, anchorY } = state.anchor;
    return useRenderElement("div", rest, {
        state,
        props: { ...attributes, children },
        style: {
            position: "absolute",
            top: 0,
            left: 0,
            transform: `translate(${x}px, ${y}px) translate(${-anchorX * 100}%, ${-anchorY * 100}%)`,
        },
    });
}
