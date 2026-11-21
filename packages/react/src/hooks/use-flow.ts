import type {
    AnyTypes,
    FlowEngine,
    FlowFeatures,
    FlowModel,
    FlowTypes,
} from "@fragiola/flow";
import { typedEngine, typedModel, useFlowContext } from "../context";

export interface UseFlowResult<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
> {
    /**
     * the model of the enclosing `Flow.Root`: the flow's document and its rules. Change it with
     * `model.run("node.move", { nodeId, position })`, read it with `model.get` / `model.is`
     */
    model: FlowModel<T, F>;
    /**
     * the engine of the flow on screen: screen actions (`engine.run("fit-view")`), screen facts
     * (`engine.get("viewport")`) and its events (`engine.subscribe`). It is there from the first
     * render; before the root is mounted (and on the server) an action is refused and a read is
     * empty
     */
    engine: FlowEngine<T, F>;
}

/**
 * The model and the engine of the enclosing `Flow.Root`. Pass the registry and the features as the
 * type arguments (`useFlow<Types, typeof features>()`): a child cannot infer them through context.
 */
export function useFlow<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
>(): UseFlowResult<T, F> {
    const context = useFlowContext("useFlow");
    return {
        model: typedModel<T, F>(context.model),
        engine: typedEngine<T, F>(context.publicEngine),
    };
}
