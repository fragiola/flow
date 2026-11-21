import type {
    HandleSide,
    NodeToolbarPosition,
    PartAttributes,
} from "@fragiola/flow";
import type * as React from "react";
import { createPortal } from "react-dom";
import { useFlowContext, useNodeId } from "../context";
import { useFlowValue } from "../hooks/internal";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";

export interface NodeToolbarState {
    readonly nodeId: string;
    /** where it is anchored, in pixels relative to the root */
    readonly position: NodeToolbarPosition;
    readonly side: HandleSide;
}

export interface NodeToolbarProps extends DivPrimitiveProps<NodeToolbarState> {
    /** its node; default the enclosing `Flow.Node`'s */
    nodeId?: string | undefined;
    /** the node's side it stands on; default `"top"` */
    side?: HandleSide | undefined;
    /** where along that side; default `"center"` */
    align?: "start" | "center" | "end" | undefined;
    /** the gap between the node and the toolbar, in pixels; default 10 */
    offset?: number | undefined;
    /** whether it is shown; default while its node is selected (`selection()`) */
    open?: boolean | undefined;
    children?: React.ReactNode;
}

/**
 * A toolbar next to a node (`data-flow-part="toolbar"`), outside the zoom: rendered in
 * `Flow.Root` (a portal), at the anchor `node-toolbar-by` gives, so it keeps its size at any zoom.
 * Presses and the wheel over it are left to it. It renders only its children (your buttons).
 */
export function NodeToolbar(props: NodeToolbarProps) {
    const {
        nodeId: nodeIdProp,
        side = "top",
        align,
        offset,
        open,
        ...rest
    } = props;
    const nodeId = useNodeId("NodeToolbar", nodeIdProp);
    const { model, engine, rootElement } = useFlowContext("NodeToolbar");
    const view = useFlowValue(model, engine, () => {
        if (!engine) return undefined;
        const position = engine.get("node-toolbar-by", {
            nodeId,
            side,
            align,
            offset,
        });
        return position
            ? {
                  position,
                  attributes: engine.adapter.attributes("toolbar", { nodeId }),
                  selected: model.is("node-selected", { nodeId }),
              }
            : undefined;
    });
    const shown = open ?? view?.selected ?? false;
    if (!view || !shown || !rootElement) return null;
    return createPortal(
        <NodeToolbarElement
            {...rest}
            state={{ nodeId, position: view.position, side }}
            attributes={view.attributes}
        />,
        rootElement,
    );
}

function NodeToolbarElement(
    props: Omit<
        NodeToolbarProps,
        "nodeId" | "side" | "align" | "offset" | "open"
    > & {
        state: NodeToolbarState;
        attributes: PartAttributes;
    },
) {
    const { state, attributes, children, ...rest } = props;
    const { x, y, anchorX, anchorY } = state.position;
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
