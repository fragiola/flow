// The Svelte form of Vue's `typedFlow` (packages/vue/src/typed.ts, from Splitter): a template
// passes no type argument to a component, and a snippet's parameter is not inferred from the
// component's generics unless it is annotated, so the registry and the features are given once.
import type { AnyTypes, FlowFeatures, FlowTypes } from "@fragiola/flow";
import type { Component } from "svelte";
import type { EdgeProps } from "./components/edge.svelte";
import type { EdgesProps } from "./components/edges.svelte";
import type { NodeProps } from "./components/node.svelte";
import type { NodesProps } from "./components/nodes.svelte";
import type { RootProps } from "./components/root.svelte";
import * as parts from "./parts.js";

/**
 * The `Flow` primitives typed by the registry `T` and the features `F`: the root's model, lists,
 * features and callbacks, and the nodes and edges the snippets give and the parts take. The others
 * are the same as `Flow`'s.
 */
export type TypedFlow<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
> = Omit<typeof parts, "Root" | "Nodes" | "Node" | "Edges" | "Edge"> & {
    Root: Component<
        RootProps<T, F>,
        Record<string, never>,
        "nodes" | "edges" | "viewport" | "ref"
    >;
    Nodes: Component<NodesProps<T>, Record<string, never>, "ref">;
    Node: Component<NodeProps<T>, Record<string, never>, "ref">;
    Edges: Component<EdgesProps<T>, Record<string, never>, "ref">;
    Edge: Component<EdgeProps<T>, Record<string, never>, "ref">;
};

/**
 * The `Flow` primitives typed by your registry and features: what React writes as type arguments
 * (`<Flow.Nodes<Types>>`), which a Svelte template cannot pass. The same components, typed:
 *
 * ```svelte
 * <script lang="ts">
 *     const Flow = typedFlow<Types, typeof features>();
 * </script>
 * <!-- {#snippet children(node)}: `node.data` is the registry's -->
 * ```
 */
export function typedFlow<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
>(): TypedFlow<T, F> {
    return parts as unknown as TypedFlow<T, F>;
}
