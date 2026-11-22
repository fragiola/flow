import type * as React from "react";
import {
    type HandleState,
    type UseHandleOptions,
    useHandle,
} from "../hooks/use-handle";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";

export interface HandleProps
    extends DivPrimitiveProps<HandleState>,
        UseHandleOptions {
    children?: React.ReactNode;
}

/** Where a handle sits by default: centred on its side of the node (a style may move it). */
const SIDE_STYLE: Record<HandleProps["side"], React.CSSProperties> = {
    top: { top: 0, left: "50%", transform: "translate(-50%, -50%)" },
    right: { top: "50%", left: "100%", transform: "translate(-50%, -50%)" },
    bottom: { top: "100%", left: "50%", transform: "translate(-50%, -50%)" },
    left: { top: "50%", left: 0, transform: "translate(-50%, -50%)" },
};

const HANDLE_STYLE: React.CSSProperties = { position: "absolute" };

/**
 * A node's connection point (`data-flow-part="handle"`, `data-handle-type`, `data-side`), inside
 * `Flow.Node`: registered with the engine (D8), which measures its centre; with `connection()`, a
 * press on it draws a connection. Absolutely positioned at the middle of its `side` by default;
 * your `style` may place it elsewhere on the node. Give it its size and look.
 */
export function Handle(props: HandleProps) {
    const {
        type,
        side,
        handleId,
        connectable,
        connectableStart,
        connectableEnd,
        nodeId,
        children,
        ...rest
    } = props;
    const { state, props: own } = useHandle({
        type,
        side,
        handleId,
        connectable,
        connectableStart,
        connectableEnd,
        nodeId,
    });
    const { ref, ...attributes } = own;
    return useRenderElement("div", rest, {
        state,
        ref: ref as React.Ref<Element>,
        props: { ...attributes, children },
        style: HANDLE_STYLE,
        baseStyle: SIDE_STYLE[side],
    });
}
