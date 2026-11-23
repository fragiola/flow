import {
    type AnyTypes,
    type FlowNode,
    type FlowTypes,
    flag,
    type PartAttributes,
    partAttributes,
} from "@fragiola/flow";
import {
    type ComponentInternalInstance,
    type ComputedRef,
    computed,
    ErrorCodes,
    getCurrentInstance,
    handleError,
    type MaybeRefOrGetter,
    queuePostFlushCb,
    toValue,
} from "vue";
import { useFlowContext } from "../context";
import { type ElementRef, elementRef, px } from "../utils/render";
import { sameValue, useFlowValue } from "./internal";

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

/** What goes on a node's element. */
export type NodeElementProps = {
    /** the template ref that registers the element with the engine (measured) */
    ref: ElementRef;
    tabindex: number | undefined;
    /** absolute, at its position, with the document's size when given */
    style: Record<string, string>;
} & Readonly<Record<`data-${string}`, string | undefined>>;

export interface UseNodeResult<T extends FlowTypes = AnyTypes> {
    state: ComputedRef<NodeState<T>>;
    /**
     * what goes on the node's element (`v-bind`): its attributes, `tabindex`, its structural style
     * and the template ref that registers it with the engine
     */
    props: ComputedRef<NodeElementProps>;
}

interface NodeView {
    attributes: PartAttributes;
    x: number;
    y: number;
    /** its structural `z-index` (`node-z-index-by`, or the static geometry's before the engine) */
    zIndex: number | undefined;
    focusable: boolean;
}

/** a node registration of the current patch, and the component whose element it is */
interface PendingRegistration {
    readonly register: () => void;
    readonly instance: ComponentInternalInstance | null;
}

/** the node registrations of the current patch, made once it is done (`registerLater`) */
let pending = new Set<PendingRegistration>();
let scheduled = false;

/** Makes the patch's pending registrations; one that throws goes to Vue's error handling. */
function registerPending(): void {
    scheduled = false;
    const batch = pending;
    pending = new Set();
    const failures: [unknown, PendingRegistration][] = [];
    for (const entry of batch) {
        try {
            entry.register();
        } catch (error) {
            failures.push([error, entry]);
        }
    }
    for (const [error, entry] of failures) {
        handleError(error, entry.instance, ErrorCodes.FUNCTION_REF);
    }
}

/**
 * Registers a node's element once Vue's patch is done, all the patch's nodes at once. Vue calls an
 * element's function ref as soon as the element is inserted, and the engine measures a node when
 * it is registered (`offsetWidth`): registered there, each node mounted in a patch (hundreds, on a
 * zoom out) would force a layout of its own between the insertions, where React's refs (and these)
 * come after every insertion, so the first measurement lays the page out once. The batch is a
 * post-flush job with Vue's template-ref id (-1): it runs after the patch, before the mounted
 * hooks and `flush: "post"` watchers, and before the patch's `nextTick` resolves, as a ref set
 * during the patch would. Returns whether it was still pending (then it is cancelled).
 */
function registerLater(
    register: () => void,
    instance: ComponentInternalInstance | null,
): () => boolean {
    const entry: PendingRegistration = { register, instance };
    pending.add(entry);
    if (!scheduled) {
        scheduled = true;
        queuePostFlushCb(Object.assign(() => registerPending(), { id: -1 }));
    }
    return () => pending.delete(entry);
}

/**
 * A node's state and the props of its element, for a node rendered by hand (`Flow.Node` uses it).
 * Bind `props` on the element (the engine resolves presses from its attributes), in a render that
 * reads `props.value`.
 */
export function useNode<T extends FlowTypes = AnyTypes>(
    node: MaybeRefOrGetter<FlowNode<T>>,
): UseNodeResult<T> {
    const context = useFlowContext("useNode");
    const { model } = context;
    const instance = getCurrentInstance();
    const current = () => toValue(node);
    const view = useFlowValue<NodeView>(
        context,
        () => {
            const value = current();
            const nodeId = value.id;
            const engine = context.engine.value;
            if (!engine) {
                // the static geometry (a server render, the first client render): its box with the
                // node origin applied and its z-index, as the engine gives them before measuring
                const geometry = context.geometry.value;
                const rect = geometry?.nodeRects[nodeId];
                const at = rect
                    ? undefined
                    : model.get("absolute-position-by", { nodeId });
                return {
                    attributes: {
                        ...partAttributes("node", nodeId),
                        "data-selected": flag(value.selected === true),
                    },
                    x: rect?.x ?? at?.x ?? value.position.x,
                    y: rect?.y ?? at?.y ?? value.position.y,
                    zIndex: geometry?.nodeZIndexes[nodeId],
                    focusable: false,
                };
            }
            const rect = engine.get("node-rect-by", { nodeId });
            return {
                attributes: engine.adapter.attributes("node", { nodeId }),
                x: rect?.x ?? value.position.x,
                y: rect?.y ?? value.position.y,
                zIndex: engine.get("node-z-index-by", { nodeId }),
                focusable: engine.is("node-focusable", { nodeId }),
            };
        },
        sameValue,
        "entity",
        () => ({ kind: "node", id: current().id }),
    );
    const ref = elementRef(
        (element) => {
            const engine = context.engine.value;
            if (!engine) return undefined;
            const nodeId = current().id;
            const cancel = registerLater(
                () =>
                    engine.adapter.registerNode(nodeId, element as HTMLElement),
                instance,
            );
            return () => {
                if (!cancel()) engine.adapter.registerNode(nodeId, null);
            };
        },
        () => [context.engine.value, current().id],
    );
    const state = computed<NodeState<T>>(() => {
        const { attributes, x, y, focusable } = view.value;
        const value = current();
        return {
            nodeId: value.id,
            node: value,
            x,
            y,
            selected: attributes["data-selected"] !== undefined,
            dragging: attributes["data-dragging"] !== undefined,
            resizing: attributes["data-resizing"] !== undefined,
            measured: attributes["data-measured"] !== undefined,
            focusable,
            attributes,
        };
    });
    const props = computed<NodeElementProps>(() => {
        const { attributes, x, y, zIndex, focusable } = view.value;
        // the engine, read here: once it is there, the element patches and its ref registers it
        context.engine.value;
        const value = current();
        return {
            ...attributes,
            ref,
            tabindex: focusable ? 0 : undefined,
            style: {
                position: "absolute",
                top: "0",
                left: "0",
                transform: `translate(${px(x)}, ${px(y)})`,
                ...(zIndex === undefined ? {} : { zIndex: String(zIndex) }),
                ...(value.width === undefined
                    ? {}
                    : { width: px(value.width) }),
                ...(value.height === undefined
                    ? {}
                    : { height: px(value.height) }),
            },
        };
    });
    return { state, props };
}
