import {
    type HandleRegistration,
    type HandleSide,
    type HandleType,
    type PartAttributes,
    partAttributes,
} from "@fragiola/flow";
import { type Attachment, createAttachmentKey } from "svelte/attachments";
import { useFlowContext, usePartNodeId } from "../context.js";
import type { DataAttributes } from "../utils/render.js";
import {
    flowValue,
    type MaybeGetter,
    read,
    sameValue,
} from "./internal.svelte.js";

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

/** What goes on a handle's element (`{...props}`). */
export type HandleElementProps = {
    /** the attachment that registers the element with the engine (D8) */
    readonly [attachment: symbol]: Attachment<Element>;
} & DataAttributes;

export interface UseHandleResult {
    readonly state: HandleState;
    /** what goes on the handle's element: its attributes and the attachment that registers it */
    readonly props: HandleElementProps;
}

/** A registration's identity: a change registers the handle again. */
function registrationKey(registration: HandleRegistration): string {
    return JSON.stringify([
        registration.nodeId,
        registration.handleId ?? null,
        registration.type,
        registration.side,
        registration.connectable ?? null,
        registration.connectableStart ?? null,
        registration.connectableEnd ?? null,
    ]);
}

/**
 * A handle's state and the props of its element, for a handle rendered by hand (`Flow.Handle`
 * uses it): registered with the engine, which measures its centre relative to its node. Pass the
 * options, or a getter of them to follow props (`useHandle(() => ({ type, side }))`).
 */
export function useHandle(
    options: MaybeGetter<UseHandleOptions>,
): UseHandleResult {
    const context = useFlowContext("useHandle");
    const nodeIdOf = usePartNodeId("Handle", () => read(options).nodeId);
    // the last object while its fields stay: a new one registers the handle again
    let last: HandleRegistration | undefined;
    const registration = $derived.by((): HandleRegistration => {
        const {
            type,
            side,
            handleId,
            connectable,
            connectableStart,
            connectableEnd,
        } = read(options);
        const next = {
            nodeId: nodeIdOf(),
            handleId,
            type,
            side,
            connectable,
            connectableStart,
            connectableEnd,
        };
        if (
            last !== undefined &&
            registrationKey(last) === registrationKey(next)
        ) {
            return last;
        }
        last = next;
        return next;
    });
    const attributes = flowValue(
        context,
        () => {
            const value = registration;
            const engine = context.engine;
            return engine
                ? engine.adapter.attributes("handle", value)
                : {
                      ...partAttributes("handle", value.handleId),
                      "data-handle-type": value.type,
                      "data-side": value.side,
                  };
        },
        sameValue,
        { scope: "entity" },
    );
    const key = createAttachmentKey();
    const attachment: Attachment<Element> = (element) => {
        const engine = context.engine;
        const value = registration;
        if (!engine) return;
        engine.adapter.registerHandle(value, element);
        return () => engine.adapter.registerHandle(value, null);
    };
    const state = $derived.by((): HandleState => {
        const value = registration;
        const current = attributes.current;
        return {
            nodeId: value.nodeId,
            handleId: value.handleId,
            type: value.type,
            side: value.side,
            connectable: current["data-connectable"] !== undefined,
            connectableStart: current["data-connectable-start"] !== undefined,
            connectableEnd: current["data-connectable-end"] !== undefined,
            connecting: current["data-connecting"] !== undefined,
            valid: current["data-valid"] !== undefined,
            invalid: current["data-invalid"] !== undefined,
            attributes: current,
        };
    });
    const props = $derived.by(
        (): HandleElementProps => ({
            ...(attributes.current as DataAttributes),
            [key]: attachment,
        }),
    );
    return {
        get state() {
            return state;
        },
        get props() {
            return props;
        },
    };
}
