// From Tree (fragiola/tree, packages/react/src/hooks/create-tree-ref.ts), same author and licence;
// its `current` is a `$state.raw`, so a template or a `$derived` that reads it follows the root's
// mount and unmount.
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

declare const flowRefBrand: unique symbol;

/**
 * Access to a `Flow.Root` from outside it (a toolbar, a menu, a test): pass it as the root's
 * `flowRef`; `current` is the root's model and engine while it is mounted, `null` otherwise.
 * `current` is reactive: a template that reads it updates when the root mounts or unmounts.
 */
export interface FlowRef<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
> {
    /** the root's model and engine while it is mounted, `null` otherwise */
    readonly current: FlowRefValue<T, F> | null;
    /** only `createFlowRef` and `useFlowRef` make a flow ref */
    readonly [flowRefBrand]: true;
}

/** the setter behind each flow ref, which only `Flow.Root` calls */
const setters = new WeakMap<object, (value: FlowRefValue | null) => void>();

/**
 * Creates a flow ref anywhere (a module, a test, a component's script, where `useFlowRef` says the
 * same).
 *
 * ```ts
 * const flow = createFlowRef<Types, typeof features>();
 * // <Flow.Root flowRef={flow} {features} defaultNodes={nodes}>…</Flow.Root>
 * flow.current?.engine.run("fit-view");
 * ```
 */
export function createFlowRef<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
>(): FlowRef<T, F> {
    let value = $state.raw<FlowRefValue | null>(null);
    const flow = Object.freeze({
        get current() {
            return value;
        },
    });
    setters.set(flow, (next) => {
        value = next;
    });
    return flow as unknown as FlowRef<T, F>;
}

/** @internal what `Flow.Root` calls: attaches (or, with `null`, detaches) its model and engine */
export function setFlowRef(
    flow: FlowRef<FlowTypes, FlowFeatures>,
    next: FlowRefValue<FlowTypes, FlowFeatures> | null,
): void {
    const set = setters.get(flow);
    if (!set) {
        throw new TypeError(
            "Flow.Root: `flowRef` takes a flow ref from useFlowRef or createFlowRef",
        );
    }
    set(next as unknown as FlowRefValue | null);
}
