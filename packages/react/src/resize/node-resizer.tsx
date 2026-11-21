import type * as React from "react";
import { useFlowContext, useNodeId } from "../context";
import { useFlowValue, useIsomorphicLayoutEffect } from "../hooks/internal";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";
import { RESIZE_POSITIONS, ResizeHandle } from "./resize-handle";

export interface NodeResizerState {
    readonly nodeId: string;
    /** its node is being resized: `data-resizing` */
    readonly resizing: boolean;
}

export interface NodeResizerProps extends DivPrimitiveProps<NodeResizerState> {
    /** its node; default the enclosing `Flow.Node`'s */
    nodeId?: string | undefined;
    /** this node's limits, over `resize()`'s (in flow units) */
    minWidth?: number | undefined;
    minHeight?: number | undefined;
    maxWidth?: number | undefined;
    maxHeight?: number | undefined;
    /** this node keeps its aspect ratio, over `resize()`'s */
    keepAspectRatio?: boolean | undefined;
    /** its handles; default a `ResizeHandle` at each corner and side */
    children?: React.ReactNode;
}

const RESIZER_STYLE: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
};

/**
 * A node's resizer (`data-flow-part="resizer"`, `resize()`), inside `Flow.Node`: a box over the
 * node holding its `ResizeHandle`s; its limits are this node's own (`setPartOptions`). Render it
 * only when the node should be resizable (while it is selected, say).
 */
export function NodeResizer(props: NodeResizerProps) {
    const {
        nodeId: nodeIdProp,
        minWidth,
        minHeight,
        maxWidth,
        maxHeight,
        keepAspectRatio,
        children,
        ...rest
    } = props;
    const nodeId = useNodeId("NodeResizer", nodeIdProp);
    const { model, engine } = useFlowContext("NodeResizer");
    useIsomorphicLayoutEffect(() => {
        if (!engine) return;
        const options = Object.fromEntries(
            Object.entries({
                minWidth,
                minHeight,
                maxWidth,
                maxHeight,
                keepAspectRatio,
            }).filter(([, value]) => value !== undefined),
        );
        engine.adapter.setPartOptions("resizer", nodeId, options);
        return () => engine.adapter.setPartOptions("resizer", nodeId, null);
    }, [
        engine,
        nodeId,
        minWidth,
        minHeight,
        maxWidth,
        maxHeight,
        keepAspectRatio,
    ]);
    const attributes = useFlowValue(model, engine, () =>
        engine
            ? engine.adapter.attributes("resizer", { nodeId })
            : { "data-flow-part": "resizer", "data-flow-id": nodeId },
    );
    return useRenderElement("div", rest, {
        state: { nodeId, resizing: attributes["data-resizing"] !== undefined },
        props: {
            ...attributes,
            children:
                children ??
                RESIZE_POSITIONS.map((position) => (
                    <ResizeHandle
                        key={position}
                        position={position}
                        nodeId={nodeId}
                    />
                )),
        },
        style: RESIZER_STYLE,
    });
}
