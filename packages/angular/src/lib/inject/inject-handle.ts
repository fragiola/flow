import {
    afterRenderEffect,
    computed,
    type Signal,
    untracked,
} from "@angular/core";
import {
    type HandleRegistration,
    type HandleSide,
    type HandleType,
    type PartAttributes,
    partAttributes,
} from "@fragiola/flow";
import {
    type FlowContext,
    injectFlowContext,
    injectNodeContext,
} from "../context";
import {
    bindAttributes,
    bindBaseStyle,
    bindStructuralStyle,
    injectHost,
    type StructuralStyle,
} from "../utils/helpers";
import {
    flowValue,
    partOwnerId,
    type ValueOrSignal,
    valueNow,
} from "./internal";

export interface InjectHandleOptions {
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
    /** its node; default the enclosing `[flowNode]`'s */
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

export interface InjectHandleResult {
    /** the handle's state (`undefined` until its node and its inputs are known) */
    readonly state: Signal<HandleState | undefined>;
}

/** Where a handle sits by default: centred on its side of the node (a style may move it). */
const SIDE_STYLE: Record<HandleSide, StructuralStyle> = {
    top: { top: 0, left: "50%", transform: "translate(-50%, -50%)" },
    right: { top: "50%", left: "100%", transform: "translate(-50%, -50%)" },
    bottom: { top: "100%", left: "50%", transform: "translate(-50%, -50%)" },
    left: { top: "50%", left: 0, transform: "translate(-50%, -50%)" },
};

/** Two registrations of the same handle. */
function sameRegistration(
    a: HandleRegistration | undefined,
    b: HandleRegistration | undefined,
): boolean {
    return (
        a === b ||
        (a !== undefined &&
            b !== undefined &&
            a.nodeId === b.nodeId &&
            a.handleId === b.handleId &&
            a.type === b.type &&
            a.side === b.side &&
            a.connectable === b.connectable &&
            a.connectableStart === b.connectableStart &&
            a.connectableEnd === b.connectableEnd)
    );
}

/**
 * A handle's state, and its element bound (React's `useHandle`), for a handle rendered by hand:
 * call it in the constructor (or a field) of the component or directive whose host element is the
 * handle, inside a `[flowNode]` (`[flowHandle]` uses it). The element gets the handle's attributes
 * and its place (absolute, centred on its side by default: a style may move it), and is registered
 * with the engine (D8), which measures its centre.
 */
export function injectHandle(
    options: ValueOrSignal<InjectHandleOptions>,
): InjectHandleResult {
    const context = injectFlowContext("injectHandle");
    const nodeId = partOwnerId(
        "injectHandle",
        () => valueNow(options)?.nodeId,
        injectNodeContext(),
        "node",
    );
    return bindHandle(context, injectHost(), () => {
        const given = valueNow(options);
        const id = nodeId();
        return given && id !== undefined ? { ...given, nodeId: id } : undefined;
    });
}

/** @internal `injectHandle` over a context, an element and its registration */
export function bindHandle(
    context: FlowContext,
    element: HTMLElement,
    options: () => InjectHandleOptions | undefined,
): InjectHandleResult {
    const registration = computed(
        (): HandleRegistration | undefined => {
            const given = options();
            if (!given || given.nodeId === undefined) return undefined;
            return {
                nodeId: given.nodeId,
                handleId: given.handleId,
                type: given.type,
                side: given.side,
                connectable: given.connectable,
                connectableStart: given.connectableStart,
                connectableEnd: given.connectableEnd,
            };
        },
        { equal: sameRegistration },
    );
    const attributes = flowValue(
        context,
        (): PartAttributes | undefined => {
            const handle = registration();
            if (!handle) return undefined;
            const engine = context.engine();
            return engine
                ? engine.adapter.attributes("handle", handle)
                : {
                      ...partAttributes("handle", handle.handleId),
                      "data-handle-type": handle.type,
                      "data-side": handle.side,
                  };
        },
        undefined,
        { scope: "entity" },
    );
    const state = computed((): HandleState | undefined => {
        const handle = registration();
        const current = attributes();
        if (!handle || !current) return undefined;
        return {
            nodeId: handle.nodeId,
            handleId: handle.handleId,
            type: handle.type,
            side: handle.side,
            connectable: current["data-connectable"] !== undefined,
            connectableStart: current["data-connectable-start"] !== undefined,
            connectableEnd: current["data-connectable-end"] !== undefined,
            connecting: current["data-connecting"] !== undefined,
            valid: current["data-valid"] !== undefined,
            invalid: current["data-invalid"] !== undefined,
            attributes: current,
        };
    });
    bindAttributes(element, () => attributes() ?? {});
    bindStructuralStyle(element, () => ({ position: "absolute" }));
    bindBaseStyle(element, () => {
        const side = registration()?.side;
        return side ? SIDE_STYLE[side] : {};
    });
    // registered after the render in the first phase, as its node (`bindNode`): after it, and
    // before the app's own after-render hooks of the other phases
    afterRenderEffect({
        earlyRead: (onCleanup) => {
            const engine = context.engine();
            const handle = registration();
            if (!engine || !handle) return;
            untracked(() => {
                engine.adapter.registerHandle(handle, element);
                onCleanup(() => engine.adapter.registerHandle(handle, null));
            });
        },
    });
    return { state };
}
