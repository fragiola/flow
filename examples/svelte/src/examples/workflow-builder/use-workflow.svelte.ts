import type { FlowEdge, FlowModel } from "@fragiola/flow-svelte";
import type { Step, Types } from "./types";

// The panels around the canvas are outside `Flow.Root`, so they read the model itself: its nodes
// and edges are immutable arrays, replaced on every change, which `model.subscribe` follows into
// two `$state.raw` values (never deep proxies: the model's lists stay plain and frozen). Call it
// in a component's script: the subscription lives as long as that component.

export interface Workflow {
    readonly steps: readonly Step[];
    readonly edges: readonly FlowEdge<Types>[];
}

export function useWorkflow(model: FlowModel<Types>): Workflow {
    let steps = $state.raw(model.get("all-nodes"));
    let edges = $state.raw(model.get("all-edges"));
    $effect(() => {
        const read = () => {
            steps = model.get("all-nodes");
            edges = model.get("all-edges");
        };
        // what changed between this call and the effect, then every change
        read();
        return model.subscribe(read);
    });
    return {
        get steps() {
            return steps;
        },
        get edges() {
            return edges;
        },
    };
}
