import type {
    HandleSide,
    NodeToolbarPosition,
    PartAttributes,
} from "@fragiola/flow";
import * as React from "react";
import { createPortal } from "react-dom";
import { NodeContext, useFlowContext } from "../context";
import { useFlowValue } from "../hooks/internal";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";

export interface NodeToolbarState {
    /** its node (undefined for several nodes' toolbar) */
    readonly nodeId: string | undefined;
    /** the nodes it stands beside: `nodeIds`, or its one node */
    readonly nodeIds: readonly string[];
    /** where it is anchored, in pixels relative to the root */
    readonly position: NodeToolbarPosition;
    readonly side: HandleSide;
}

export interface NodeToolbarProps extends DivPrimitiveProps<NodeToolbarState> {
    /** its node; default the enclosing `Flow.Node`'s */
    nodeId?: string | undefined;
    /**
     * several nodes it stands beside (their bounds), instead of one; when not empty it wins over
     * `nodeId`, and the toolbar is shown by default while every one of them is selected
     */
    nodeIds?: readonly string[] | undefined;
    /** the node's side it stands on; default `"top"` */
    side?: HandleSide | undefined;
    /** where along that side; default `"center"` */
    align?: "start" | "center" | "end" | undefined;
    /** the gap between the node and the toolbar, in pixels; default 10 */
    offset?: number | undefined;
    /** whether it is shown; default while its node (every node of `nodeIds`) is selected (`selection()`) */
    open?: boolean | undefined;
    children?: React.ReactNode;
}

/**
 * A toolbar next to a node, or beside several nodes' bounds (`nodeIds`; `data-flow-part="toolbar"`),
 * outside the zoom: rendered in
 * `Flow.Root` (a portal), at the anchor `node-toolbar-by` gives, so it keeps its size at any zoom.
 * Presses and the wheel over it are left to it. It renders only its children (your buttons).
 */
export function NodeToolbar(props: NodeToolbarProps) {
    const {
        nodeId: nodeIdProp,
        nodeIds: nodeIdsProp,
        side = "top",
        align,
        offset,
        open,
        ...rest
    } = props;
    const around = React.useContext(NodeContext);
    const many = nodeIdsProp !== undefined && nodeIdsProp.length > 0;
    const nodeId = many ? undefined : (nodeIdProp ?? around?.nodeId);
    if (!many && nodeId === undefined) {
        throw new Error(
            "Flow.NodeToolbar must be rendered inside Flow.Node (or be given a nodeId or nodeIds)",
        );
    }
    const { model, engine, rootElement } = useFlowContext("NodeToolbar");
    const view = useFlowValue(model, engine, () => {
        if (!engine) return undefined;
        const nodeIds = many ? nodeIdsProp : [nodeId as string];
        const position = engine.get("node-toolbar-by", {
            ...(many ? { nodeIds } : { nodeId }),
            side,
            align,
            offset,
        });
        return position
            ? {
                  position,
                  nodeIds,
                  attributes: engine.adapter.attributes(
                      "toolbar",
                      many ? {} : { nodeId },
                  ),
                  selected: nodeIds.every((id) =>
                      model.is("node-selected", { nodeId: id }),
                  ),
              }
            : undefined;
    });
    const shown = open ?? view?.selected ?? false;
    if (!view || !shown || !rootElement) return null;
    return createPortal(
        <NodeToolbarElement
            {...rest}
            state={{
                nodeId,
                nodeIds: view.nodeIds,
                position: view.position,
                side,
            }}
            attributes={view.attributes}
        />,
        rootElement,
    );
}

function NodeToolbarElement(
    props: Omit<
        NodeToolbarProps,
        "nodeId" | "nodeIds" | "side" | "align" | "offset" | "open"
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
