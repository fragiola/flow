import type { Signal } from "@angular/core";
import type { AnyTypes, FlowFeatures, FlowTypes } from "@fragiola/flow";
import { injectFlowContext, typedEngine, typedModel } from "../context";
import type { FlowRefValue } from "./create-flow-ref";
import { flowValue } from "./internal";

/**
 * A value selected from the model and the engine of the enclosing `[flowRoot]` (React's
 * `useFlowStore`), as a signal that changes only when the value does (`equal`, default
 * `Object.is`): `selector` runs again on every change of the model, every view change of the
 * engine (a measurement, the viewport, a gesture) and every change of a signal it reads. Pass the
 * registry and the features as the type arguments after the selected value's
 * (`injectFlowStore<number, Types, typeof features>(…)`). Keep a selector that builds an object or
 * an array with an `equal` that compares it (`sameFlowValue`), or it changes on every change. Call
 * it in an injection context (a constructor or a field).
 */
export function injectFlowStore<
    S,
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
>(
    selector: (flow: FlowRefValue<T, F>) => S,
    equal: (a: S, b: S) => boolean = Object.is,
): Signal<S> {
    const context = injectFlowContext("injectFlowStore");
    return flowValue(
        context,
        () =>
            selector({
                model: typedModel<T, F>(context.model()),
                engine: typedEngine<T, F>(context.publicEngine),
            }),
        equal,
    );
}
