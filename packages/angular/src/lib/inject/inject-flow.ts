import { computed, type Signal } from "@angular/core";
import type {
    AnyTypes,
    FlowEngine,
    FlowFeatures,
    FlowModel,
    FlowTypes,
} from "@fragiola/flow";
import { injectFlowContext, typedEngine, typedModel } from "../context";

export interface InjectFlowResult<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
> {
    /**
     * the model of the enclosing `[flowRoot]`: the flow's document and its rules. Change it with
     * `model().run("node.move", { nodeId, position })`, read it with `model().get` / `model().is`
     */
    readonly model: Signal<FlowModel<T, F>>;
    /**
     * the engine of the flow on screen: screen actions (`engine.run("fit-view")`), screen facts
     * (`engine.get("viewport")`) and its events (`engine.subscribe`). It is there from the start;
     * before the root created its engine an action is refused and a read is empty
     */
    readonly engine: FlowEngine<T, F>;
}

/**
 * The model and the engine of the enclosing `[flowRoot]` (React's `useFlow`). Pass the registry
 * and the features as the type arguments (`injectFlow<Types, typeof features>()`): a child cannot
 * infer them through injection. Call it in an injection context (a constructor or a field).
 */
export function injectFlow<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
>(): InjectFlowResult<T, F> {
    const context = injectFlowContext("injectFlow");
    return {
        model: computed(() => typedModel<T, F>(context.model())),
        engine: typedEngine<T, F>(context.publicEngine),
    };
}
