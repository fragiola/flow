import {
    type HandleRegistration,
    type HandleSide,
    type HandleType,
    type PartAttributes,
    partAttributes,
} from "@fragiola/flow";
import * as React from "react";
import { useFlowContext, usePartNodeId } from "../context";
import { type AttributeProps, attributeProps } from "../utils/use-render";
import { useFlowValue } from "./internal";

export interface UseHandleOptions {
    /** whether edges start (`source`) or end (`target`) here */
    type: HandleType;
    /** the side of the node it sits on: the direction its edges leave or enter by */
    side: HandleSide;
    /** its id among the node's handles of its type (none: the node's default handle) */
    handleId?: string | undefined;
    /** whether a connection may start or end here; default true */
    connectable?: boolean | undefined;
    /** whether a connection may start here (a drag, a tap, a key); default true */
    connectableStart?: boolean | undefined;
    /** whether a connection may end here (be its target); default true */
    connectableEnd?: boolean | undefined;
    /** its node; default the enclosing `Flow.Node`'s */
    nodeId?: string | undefined;
}

/** What a handle shows. */
export interface HandleState {
    readonly nodeId: string;
    readonly handleId: string | undefined;
    readonly type: HandleType;
    readonly side: HandleSide;
    /** a connection may start or end here (its flag and its node's): `data-connectable` */
    readonly connectable: boolean;
    /** a connection may start here: `data-connectable-start` */
    readonly connectableStart: boolean;
    /** a connection may end here: `data-connectable-end` */
    readonly connectableEnd: boolean;
    /** the connection under way starts here (`connection()`): `data-connecting` */
    readonly connecting: boolean;
    /** the connection under way would end here and be accepted: `data-valid` */
    readonly valid: boolean;
    /** the connection under way would end here and be refused: `data-invalid` */
    readonly invalid: boolean;
    readonly attributes: PartAttributes;
}

export interface UseHandleResult {
    state: HandleState;
    /**
     * what goes on the handle's element: its attributes (`tabIndex` with `keyboard()` and
     * `connection()`) and the ref that registers it (D8)
     */
    props: { ref: React.RefCallback<Element> } & AttributeProps;
}

/**
 * A handle's state and the props of its element, for a handle rendered by hand (`Flow.Handle`
 * uses it): registered with the engine, which measures its centre relative to its node.
 */
export function useHandle(options: UseHandleOptions): UseHandleResult {
    const { model, engine } = useFlowContext("useHandle");
    const nodeId = usePartNodeId("Handle", options.nodeId);
    const {
        type,
        side,
        handleId,
        connectable,
        connectableStart,
        connectableEnd,
    } = options;
    const registration = React.useMemo<HandleRegistration>(
        () => ({
            nodeId,
            handleId,
            type,
            side,
            connectable,
            connectableStart,
            connectableEnd,
        }),
        [
            nodeId,
            handleId,
            type,
            side,
            connectable,
            connectableStart,
            connectableEnd,
        ],
    );
    const attributes = useFlowValue(model, engine, () =>
        engine
            ? engine.adapter.attributes("handle", registration)
            : {
                  ...partAttributes("handle", handleId),
                  "data-handle-type": type,
                  "data-side": side,
              },
    );
    const ref = React.useCallback(
        (element: Element | null) => {
            if (!engine || !element) return;
            engine.adapter.registerHandle(registration, element);
            return () => engine.adapter.registerHandle(registration, null);
        },
        [engine, registration],
    );
    return {
        state: {
            nodeId,
            handleId,
            type,
            side,
            connectable: attributes["data-connectable"] !== undefined,
            connectableStart:
                attributes["data-connectable-start"] !== undefined,
            connectableEnd: attributes["data-connectable-end"] !== undefined,
            connecting: attributes["data-connecting"] !== undefined,
            valid: attributes["data-valid"] !== undefined,
            invalid: attributes["data-invalid"] !== undefined,
            attributes,
        },
        props: { ...attributeProps(attributes), ref },
    };
}
