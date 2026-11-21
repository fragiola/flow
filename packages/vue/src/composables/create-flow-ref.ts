// From Tree (fragiola/tree, packages/vue/src/composables/create-tree-ref.ts), same author and
// licence.
import type {
    AnyTypes,
    FlowEngine,
    FlowFeatures,
    FlowModel,
    FlowTypes,
} from "@fragiola/flow";
import { markRaw, type ShallowRef, shallowRef, toRaw } from "vue";

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
 * `flow-ref`; `value` is the root's model and engine while it is mounted, `null` otherwise.
 * `value` is reactive, so a render that reads it re-renders when the root mounts or unmounts.
 *
 * It is not a Vue ref: a template does not unwrap it, so `:flow-ref="flow"` passes the flow ref
 * itself, and the template reads `flow.value`, as a script does.
 */
export interface FlowRef<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
> {
    /** the root's model and engine while it is mounted, `null` otherwise */
    readonly value: FlowRefValue<T, F> | null;
    /** only `createFlowRef` and `useFlowRef` make a flow ref */
    readonly [flowRefBrand]: true;
}

/** the reactive value behind each flow ref, which only `Flow.Root` sets */
const values = new WeakMap<object, ShallowRef<FlowRefValue | null>>();

/**
 * Creates a flow ref anywhere (a module, a test, `setup`, where `useFlowRef` says the same).
 *
 * ```ts
 * const flow = createFlowRef<Types, typeof features>();
 * // <Flow.Root :flow-ref="flow" :features="features" :default-nodes="nodes">…</Flow.Root>
 * flow.value?.engine.run("fit-view");
 * ```
 */
export function createFlowRef<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
>(): FlowRef<T, F> {
    const value = shallowRef<FlowRefValue | null>(null);
    // a plain object, never made reactive: a template neither unwraps it nor wraps it in a proxy
    const flow = markRaw({
        get value() {
            return value.value;
        },
    });
    values.set(flow, value);
    return flow as unknown as FlowRef<T, F>;
}

/** @internal what `Flow.Root` calls: attaches (or, with `null`, detaches) its model and engine */
export function setFlowRef(
    flow: FlowRef<FlowTypes, FlowFeatures>,
    next: FlowRefValue<FlowTypes, FlowFeatures> | null,
): void {
    const current = values.get(toRaw(flow));
    if (!current) {
        throw new TypeError(
            "Flow.Root: `flow-ref` takes a flow ref from useFlowRef or createFlowRef",
        );
    }
    current.value = next as unknown as FlowRefValue | null;
}
