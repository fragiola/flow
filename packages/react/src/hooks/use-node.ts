import {
    type AnyTypes,
    type FlowNode,
    type FlowTypes,
    flag,
    type PartAttributes,
    partAttributes,
} from "@fragiola/flow";
import * as React from "react";
import { useFlowContext } from "../context";
import type { DataAttributes } from "../utils/use-render";
import { useFlowValue } from "./internal";

/** What a node shows: its state on screen. */
export interface NodeState<T extends FlowTypes = AnyTypes> {
    readonly nodeId: string;
    /** the node, as the model holds it */
    readonly node: FlowNode<T>;
    /** its top-left corner in absolute flow coordinates (its parents' positions added) */
    readonly x: number;
    readonly y: number;
    /** `data-selected` (`selection()`) */
    readonly selected: boolean;
    /** `data-dragging` (`drag()`) */
    readonly dragging: boolean;
    /** `data-resizing` (`resize()`) */
    readonly resizing: boolean;
    /** its size is known (measured or given): `data-measured` */
    readonly measured: boolean;
    /** it takes DOM focus (`keyboard()`): `tabindex="0"` */
    readonly focusable: boolean;
    /** the attributes its element carries (`data-flow-part`, `data-flow-id`, the state) */
    readonly attributes: PartAttributes;
}

export interface UseNodeResult<T extends FlowTypes = AnyTypes> {
    state: NodeState<T>;
    /**
     * what goes on the node's element: its attributes, `tabIndex`, its structural style (absolute,
     * at its position, its `z-index` among the nodes, with the document's size when given) and the ref that registers it with the
     * engine (measured)
     */
    props: {
        ref: React.RefCallback<HTMLElement>;
        tabIndex: number | undefined;
        style: React.CSSProperties;
    } & DataAttributes;
}

interface NodeView {
    attributes: PartAttributes;
    x: number;
    y: number;
    /** its structural `z-index` (`node-z-index-by`, or the static geometry's before the engine) */
    zIndex: number | undefined;
    focusable: boolean;
}

/**
 * A node's state and the props of its element, for a node rendered by hand (`Flow.Node` uses it).
 * Spread `props` on the element (the engine resolves presses from its attributes).
 */
export function useNode<T extends FlowTypes = AnyTypes>(
    node: FlowNode<T>,
): UseNodeResult<T> {
    const { model, engine, staticGeometry } = useFlowContext("useNode");
    const nodeId = node.id;
    const view = useFlowValue<NodeView>(model, engine, () => {
        if (!engine) {
            // the static geometry (origin applied), as the engine places it before measuring
            const rect = staticGeometry?.nodeRects[nodeId];
            // no rect (no static geometry): its absolute position, its parents' added
            const at = rect
                ? undefined
                : model.get("absolute-position-by", { nodeId });
            return {
                attributes: {
                    ...partAttributes("node", nodeId),
                    "data-selected": flag(node.selected === true),
                },
                x: rect?.x ?? at?.x ?? node.position.x,
                y: rect?.y ?? at?.y ?? node.position.y,
                zIndex: staticGeometry?.nodeZIndexes[nodeId],
                focusable: false,
            };
        }
        const rect = engine.get("node-rect-by", { nodeId });
        return {
            attributes: engine.adapter.attributes("node", { nodeId }),
            x: rect?.x ?? node.position.x,
            y: rect?.y ?? node.position.y,
            zIndex: engine.get("node-z-index-by", { nodeId }),
            focusable: engine.is("node-focusable", { nodeId }),
        };
    });
    const ref = React.useCallback(
        (element: HTMLElement | null) => {
            if (!engine || !element) return;
            engine.adapter.registerNode(nodeId, element);
            return () => engine.adapter.registerNode(nodeId, null);
        },
        [engine, nodeId],
    );
    const { attributes } = view;
    const style: React.CSSProperties = {
        position: "absolute",
        top: 0,
        left: 0,
        transform: `translate(${view.x}px, ${view.y}px)`,
        ...(view.zIndex === undefined ? {} : { zIndex: view.zIndex }),
        ...(node.width === undefined ? {} : { width: node.width }),
        ...(node.height === undefined ? {} : { height: node.height }),
    };
    return {
        state: {
            nodeId,
            node,
            x: view.x,
            y: view.y,
            selected: attributes["data-selected"] !== undefined,
            dragging: attributes["data-dragging"] !== undefined,
            resizing: attributes["data-resizing"] !== undefined,
            measured: attributes["data-measured"] !== undefined,
            focusable: view.focusable,
            attributes,
        },
        props: {
            ...(attributes as DataAttributes),
            ref,
            tabIndex: view.focusable ? 0 : undefined,
            style,
        },
    };
}
