import type { FlowEdge, FlowModel, MaybeGetter } from "@fragiola/flow-svelte";
import type { Step, Types } from "./types";

// The panels around the canvas are outside `Flow.Root`, so they read the model itself: its nodes
// and edges are immutable arrays, replaced on every change, which `model.subscribe` follows into
// two `$state.raw` values (never deep proxies: the model's lists stay plain and frozen). Call it
// in a component's script: the subscription lives as long as that component, and follows another
// model when it is given as a getter (`() => model`).

export interface Workflow {
    readonly steps: readonly Step[];
    readonly edges: readonly FlowEdge<Types>[];
}

export function useWorkflow(source: MaybeGetter<FlowModel<Types>>): Workflow {
    const current = () => (typeof source === "function" ? source() : source);
    let steps = $state.raw(current().get("all-nodes"));
    let edges = $state.raw(current().get("all-edges"));
    $effect(() => {
        const model = current();
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
