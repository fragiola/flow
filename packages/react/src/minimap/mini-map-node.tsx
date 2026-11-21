import { partAttributes } from "@fragiola/flow";
import { useFlowContext } from "../context";
import { useFlowValue } from "../hooks/internal";
import { type SvgPrimitiveProps, useRenderElement } from "../utils/use-render";
import { useMiniMapView } from "./mini-map-context";

export interface MiniMapNodeState {
    readonly nodeId: string;
    /** `data-selected` (`selection()`) */
    readonly selected: boolean;
}

export interface MiniMapNodeProps
    extends SvgPrimitiveProps<MiniMapNodeState, SVGRectElement> {
    /** the node it stands for */
    nodeId: string;
}

/**
 * A node in the `MiniMap` (`data-flow-part="minimap-node"`, `data-flow-id`): an SVG rectangle of
 * the node's box, in flow coordinates. Nothing when the node is not shown.
 */
export function MiniMapNode(props: MiniMapNodeProps) {
    const { nodeId, ...rest } = props;
    const view = useMiniMapView("MiniMapNode");
    const { model, engine } = useFlowContext("MiniMapNode");
    const attributes = useFlowValue(model, engine, () =>
        engine
            ? engine.adapter.attributes("minimap-node", { nodeId })
            : partAttributes("minimap-node", nodeId),
    );
    const box = view.nodes.find((node) => node.nodeId === nodeId);
    const element = useRenderElement("rect", rest, {
        state: { nodeId, selected: attributes["data-selected"] !== undefined },
        props: {
            ...attributes,
            x: box?.x,
            y: box?.y,
            width: box?.width,
            height: box?.height,
        },
    });
    return box ? element : null;
}
