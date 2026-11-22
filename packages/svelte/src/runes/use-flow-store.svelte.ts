import type { AnyTypes, FlowFeatures, FlowTypes } from "@fragiola/flow";
import { typedEngine, typedModel, useFlowContext } from "../context.js";
import { type FlowValue, flowValue } from "./internal.svelte.js";
import type { UseFlowResult } from "./use-flow.svelte.js";

/**
 * A value selected from the model and the engine of the enclosing `Flow.Root`, as `current`,
 * which notifies its readers only when it changes (`equal`, default `Object.is`): `selector` runs
 * again on every change of the model and every view change of the engine (a measurement, the
 * viewport, a gesture), and when a reactive value it reads changes. Pass the registry and the
 * features as the type arguments after the selected value's
 * (`useFlowStore<number, Types, typeof features>(…)`). Give a selector that builds an object or an
 * array an `equal` that compares it (`sameFlowValue`), or its readers update on every change.
 */
export function useFlowStore<
    S,
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
>(
    selector: (flow: UseFlowResult<T, F>) => S,
    equal: (a: S, b: S) => boolean = Object.is,
): FlowValue<S> {
    const context = useFlowContext("useFlowStore");
    return flowValue(
        context,
        () =>
            selector({
                model: typedModel<T, F>(context.model),
                engine: typedEngine<T, F>(context.publicEngine),
            }),
        equal,
    );
}
