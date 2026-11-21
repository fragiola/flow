import type { FlowEdge, FlowModel } from "@fragiola/flow-react";
import { useSyncExternalStore } from "react";
import type { Step, Types } from "./types";

// The panels around the canvas are outside `Flow.Root`, so they read the model itself: its nodes
// and edges are immutable arrays, replaced on every change, which `useSyncExternalStore` follows.

export interface Workflow {
    steps: readonly Step[];
    edges: readonly FlowEdge<Types>[];
}

export function useWorkflow(model: FlowModel<Types>): Workflow {
    const subscribe = (listener: () => void) => model.subscribe(listener);
    const steps = useSyncExternalStore(subscribe, () => model.get("all-nodes"));
    const edges = useSyncExternalStore(subscribe, () => model.get("all-edges"));
    return { steps, edges };
}
