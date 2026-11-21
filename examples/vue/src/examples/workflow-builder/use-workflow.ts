import type { FlowEdge, FlowModel } from "@fragiola/flow-vue";
import { onScopeDispose, type ShallowRef, shallowRef } from "vue";
import type { Step, Types } from "./types";

// The panels around the canvas are outside `Flow.Root`, so they read the model itself: its nodes
// and edges are immutable arrays, replaced on every change, which `model.subscribe` follows into
// two shallow refs (never deep-reactive: the model's lists stay plain and frozen).

export interface Workflow {
    steps: Readonly<ShallowRef<readonly Step[]>>;
    edges: Readonly<ShallowRef<readonly FlowEdge<Types>[]>>;
}

export function useWorkflow(model: FlowModel<Types>): Workflow {
    const steps = shallowRef(model.get("all-nodes"));
    const edges = shallowRef(model.get("all-edges"));
    const unsubscribe = model.subscribe(() => {
        steps.value = model.get("all-nodes");
        edges.value = model.get("all-edges");
    });
    onScopeDispose(unsubscribe);
    return { steps, edges };
}
