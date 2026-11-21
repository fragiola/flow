import { DestroyRef, inject, type Signal, signal } from "@angular/core";
import type { FlowEdge, FlowModel } from "@fragiola/flow-angular";
import type { Step, Types } from "./types";

// The panels around the canvas are outside the root, so they read the model itself: its nodes and
// edges are immutable arrays, replaced on every change, which `model.subscribe` puts into signals
// (examples/react's `use-workflow.ts`). Called in an injection context (a field or a
// constructor): the listener stops with the component.

export interface Workflow {
    steps: Signal<readonly Step[]>;
    edges: Signal<readonly FlowEdge<Types>[]>;
}

export function injectWorkflow(model: FlowModel<Types>): Workflow {
    const steps = signal(model.get("all-nodes"));
    const edges = signal(model.get("all-edges"));
    const stop = model.subscribe(() => {
        steps.set(model.get("all-nodes"));
        edges.set(model.get("all-edges"));
    });
    inject(DestroyRef).onDestroy(stop);
    return { steps: steps.asReadonly(), edges: edges.asReadonly() };
}
