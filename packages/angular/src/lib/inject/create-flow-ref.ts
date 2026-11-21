// From packages/react/src/hooks/create-flow-ref.ts (Tree's), with the value in a signal: a
// template or a computed that reads `flow.current` follows the root as it attaches and detaches,
// so Angular needs no `useFlowRef` re-render (`injectFlowRef` is the same ref, made in a field).
import { signal, untracked, type WritableSignal } from "@angular/core";
import type {
    AnyTypes,
    FlowEngine,
    FlowFeatures,
    FlowModel,
    FlowTypes,
} from "@fragiola/flow";

/** What a flow ref gives once its `[flowRoot]` is rendered: the root's model and engine. */
export interface FlowRefValue<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
> {
    readonly model: FlowModel<T, F>;
    readonly engine: FlowEngine<T, F>;
}

/**
 * Access to a `[flowRoot]` from outside it (a toolbar, a menu, a test): pass it as the root's
 * `flowRef`; `current` is the root's model and engine while it lives, `null` otherwise. Reading
 * `current` in a template, a `computed` or an `effect` follows it.
 */
export interface FlowRef<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
> {
    readonly current: FlowRefValue<T, F> | null;
}

const slots = new WeakMap<object, WritableSignal<FlowRefValue | null>>();

function slotOf(ref: object): WritableSignal<FlowRefValue | null> {
    const slot = slots.get(ref);
    if (!slot) throw new Error("not a flow ref: create it with createFlowRef");
    return slot;
}

/**
 * Creates a flow ref, anywhere (a module, a service, a test, a component's field).
 *
 * ```ts
 * readonly flow = createFlowRef<Types, typeof features>();
 * // <div flowRoot [flowRef]="flow" [features]="features" [defaultNodes]="nodes">…</div>
 * fit() { this.flow.current?.engine.run("fit-view"); }
 * ```
 */
export function createFlowRef<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
>(): FlowRef<T, F> {
    const slot = signal<FlowRefValue | null>(null);
    const ref: FlowRef<T, F> = Object.freeze({
        get current() {
            return slot() as unknown as FlowRefValue<T, F> | null;
        },
    });
    slots.set(ref, slot);
    return ref;
}

/** @internal what `[flowRoot]` calls: attaches (or, with `null`, detaches) its model and engine */
export function setFlowRef(
    ref: FlowRef<FlowTypes, FlowFeatures>,
    value: FlowRefValue<FlowTypes, FlowFeatures> | null,
): void {
    const slot = slotOf(ref);
    if ((untracked(slot) as unknown) === value) return;
    slot.set(value as unknown as FlowRefValue | null);
}
