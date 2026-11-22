import {
    type HandleRegistration,
    type HandleSide,
    type HandleType,
    type PartAttributes,
    partAttributes,
} from "@fragiola/flow";
import {
    type ComputedRef,
    computed,
    type MaybeRefOrGetter,
    toValue,
} from "vue";
import { useFlowContext, usePartNodeId } from "../context";
import { type ElementRef, elementRef } from "../utils/render";
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

/** What goes on a handle's element. */
export type HandleElementProps = {
    /** the template ref that registers the element with the engine (D8) */
    ref: ElementRef;
} & Readonly<Record<`data-${string}`, string | undefined>>;

export interface UseHandleResult {
    state: ComputedRef<HandleState>;
    /** what goes on the handle's element (`v-bind`): its attributes and its template ref */
    props: ComputedRef<HandleElementProps>;
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
 * uses it): registered with the engine, which measures its centre relative to its node.
 */
export function useHandle(
    options: MaybeRefOrGetter<UseHandleOptions>,
): UseHandleResult {
    const context = useFlowContext("useHandle");
    const nodeIdOf = usePartNodeId("Handle", () => toValue(options).nodeId);
    // the last object while its fields stay: a new one registers the handle again
    const registration = computed<HandleRegistration>((previous) => {
        const {
            type,
            side,
            handleId,
            connectable,
            connectableStart,
            connectableEnd,
        } = toValue(options);
        const next = {
            nodeId: nodeIdOf(),
            handleId,
            type,
            side,
            connectable,
            connectableStart,
            connectableEnd,
        };
        return previous !== undefined &&
            registrationKey(previous) === registrationKey(next)
            ? previous
            : next;
    });
    const attributes = useFlowValue(context, () => {
        const value = registration.value;
        const engine = context.engine.value;
        return engine
            ? engine.adapter.attributes("handle", value)
            : {
                  ...partAttributes("handle", value.handleId),
                  "data-handle-type": value.type,
                  "data-side": value.side,
              };
    });
    const ref = elementRef(
        (element) => {
            const engine = context.engine.value;
            if (!engine) return undefined;
            const value = registration.value;
            engine.adapter.registerHandle(value, element);
            return () => engine.adapter.registerHandle(value, null);
        },
        () => [context.engine.value, registrationKey(registration.value)],
    );
    const state = computed<HandleState>(() => {
        const value = registration.value;
        const current = attributes.value;
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
    const props = computed<HandleElementProps>(() => {
        context.engine.value;
        return { ...attributes.value, ref };
    });
    return { state, props };
}
