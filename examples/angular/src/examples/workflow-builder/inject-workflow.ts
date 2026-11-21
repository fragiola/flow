import { computed, effect, type Signal, signal } from "@angular/core";
import type { FlowEdge, FlowModel } from "@fragiola/flow-angular";
import type { Step, Types } from "./types";

// The panels around the canvas are outside the root, so they read the model itself: its nodes and
// edges are immutable arrays, replaced on every change, which `model.subscribe` turns into signals
// (examples/react's `use-workflow.ts`). Called in an injection context (a field or a constructor),
// with the model or a getter of it (an input): the listener follows the model and stops with the
// component (the effect's cleanup).

export interface Workflow {
    steps: Signal<readonly Step[]>;
    edges: Signal<readonly FlowEdge<Types>[]>;
}

export function injectWorkflow(model: () => FlowModel<Types>): Workflow {
    // bumped on every change of the model: the lists below read it again
    const revision = signal(0);
    effect((onCleanup) => {
        onCleanup(model().subscribe(() => revision.update((n) => n + 1)));
    });
    const steps = computed(() => {
        revision();
        return model().get("all-nodes");
    });
    const edges = computed(() => {
        revision();
        return model().get("all-edges");
    });
    return { steps, edges };
}
