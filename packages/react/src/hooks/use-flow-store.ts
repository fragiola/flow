import type { AnyTypes, FlowFeatures, FlowTypes } from "@fragiola/flow";
import { typedEngine, typedModel, useFlowContext } from "../context";
import { useFlowValue } from "./internal";
import type { UseFlowResult } from "./use-flow";

/**
 * A value selected from the model and the engine of the enclosing `Flow.Root`, re-rendering the
 * component only when it changes (`equal`, default `Object.is`): `selector` runs again on every
 * change of the model and every view change of the engine (a measurement, the viewport, a
 * gesture), and on every render. Pass the registry and the features as the type arguments after
 * the selected value's (`useFlowStore<number, Types, typeof features>(…)`). Keep a selector that
 * builds an object or an array with an `equal` that compares it (`sameFlowValue`), or it
 * re-renders on every change.
 */
export function useFlowStore<
    S,
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
>(
    selector: (flow: UseFlowResult<T, F>) => S,
    equal: (a: S, b: S) => boolean = Object.is,
): S {
    const { model, engine, publicEngine } = useFlowContext("useFlowStore");
    return useFlowValue(
        model,
        engine,
        () =>
            selector({
                model: typedModel<T, F>(model),
                engine: typedEngine<T, F>(publicEngine),
            }),
        equal,
    );
}
