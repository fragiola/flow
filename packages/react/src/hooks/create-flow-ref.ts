// From Tree (fragiola/tree, packages/react/src/hooks/create-tree-ref.ts), same author and licence.
import type {
    AnyTypes,
    FlowEngine,
    FlowFeatures,
    FlowModel,
    FlowTypes,
} from "@fragiola/flow";

/** What a flow ref gives once its `Flow.Root` is mounted: the root's model and engine. */
export interface FlowRefValue<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
> {
    readonly model: FlowModel<T, F>;
    readonly engine: FlowEngine<T, F>;
}

/**
 * Access to a `Flow.Root` from outside it (a toolbar, a menu, a test): pass it as the root's
 * `flowRef`; `current` is the root's model and engine while it is mounted, `null` otherwise.
 */
export interface FlowRef<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
> {
    readonly current: FlowRefValue<T, F> | null;
}

interface RefSlot {
    value: FlowRefValue | null;
    readonly listeners: Set<() => void>;
}

const slots = new WeakMap<object, RefSlot>();

function slotOf(ref: object): RefSlot {
    const slot = slots.get(ref);
    if (!slot) throw new Error("not a flow ref: create it with createFlowRef");
    return slot;
}

/**
 * Creates a flow ref outside React (a module, a test). In a component, `useFlowRef` keeps one and
 * re-renders when it attaches.
 *
 * ```tsx
 * const flow = createFlowRef<Types, typeof features>();
 * <Flow.Root flowRef={flow} features={features} defaultNodes={nodes}>…</Flow.Root>;
 * flow.current?.engine.run("fit-view");
 * ```
 */
export function createFlowRef<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
>(): FlowRef<T, F> {
    const slot: RefSlot = { value: null, listeners: new Set() };
    const ref: FlowRef<T, F> = Object.freeze({
        get current() {
            return slot.value as unknown as FlowRefValue<T, F> | null;
        },
    });
    slots.set(ref, slot);
    return ref;
}

/** @internal what `Flow.Root` calls: attaches (or, with `null`, detaches) its model and engine */
export function setFlowRef(
    ref: FlowRef<FlowTypes, FlowFeatures>,
    value: FlowRefValue<FlowTypes, FlowFeatures> | null,
): void {
    const slot = slotOf(ref);
    if ((slot.value as unknown) === value) return;
    slot.value = value as unknown as FlowRefValue | null;
    for (const listener of [...slot.listeners]) listener();
}

/** @internal calls `listener` when the ref attaches or detaches; returns its remover */
export function subscribeFlowRef(
    ref: FlowRef<FlowTypes, FlowFeatures>,
    listener: () => void,
): () => void {
    const { listeners } = slotOf(ref);
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
