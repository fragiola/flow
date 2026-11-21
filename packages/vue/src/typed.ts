// From Splitter (fragiola/splitter, packages/vue/src/typed.ts), same author and licence.
import type { AnyTypes, FlowFeatures, FlowTypes } from "@fragiola/flow";
import type { EdgeProps, EdgeSlots } from "./components/edge";
import type { EdgesProps, EdgesSlots } from "./components/edges";
import type { NodeProps, NodeSlots } from "./components/node";
import type { NodesProps, NodesSlots } from "./components/nodes";
import type { RootEmits, RootProps, RootSlots } from "./components/root";
import * as parts from "./parts";
import type { FlowComponent } from "./utils/primitive";

/**
 * The `Flow` primitives typed by the registry `T` and the features `F`: the root's model, lists
 * and features, and the nodes and edges the slots give and the parts take. The others are the
 * same as `Flow`'s.
 */
export type TypedFlow<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
> = Omit<typeof parts, "Root" | "Nodes" | "Node" | "Edges" | "Edge"> & {
    Root: FlowComponent<RootProps<T, F>, RootSlots, RootEmits<T>>;
    Nodes: FlowComponent<NodesProps, NodesSlots<T>>;
    Node: FlowComponent<NodeProps<T>, NodeSlots<T>>;
    Edges: FlowComponent<EdgesProps, EdgesSlots<T>>;
    Edge: FlowComponent<EdgeProps<T>, EdgeSlots<T>>;
};

/**
 * The `Flow` primitives typed by your registry and features: what React writes as type arguments
 * (`<Flow.Nodes<Types>>`), which a Vue template cannot pass. The same components, typed:
 *
 * ```ts
 * const Flow = typedFlow<Types, typeof features>();
 * // <Flow.Nodes v-slot="{ node }">: `node.data` is the registry's
 * ```
 */
export function typedFlow<
    T extends FlowTypes = AnyTypes,
    F extends FlowFeatures = readonly [],
>(): TypedFlow<T, F> {
    return parts as unknown as TypedFlow<T, F>;
}
