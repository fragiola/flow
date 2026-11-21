// The flow document (D3): `{ version: 1, nodes, edges }`, JSON-shaped, the model's whole state.
// A node and an edge are plain readonly objects told apart by their `type`; the app's `Types`
// registry narrows each type's `data`. A feature's fields (`selected`, `parentId`, …) are declared
// here, optional: the document format stays whole, and a field of a feature that is not installed
// is a validation issue (never dropped silently).

/** A point or an offset in flow coordinates: x grows to the right, y grows down. */
export interface XY {
    readonly x: number;
    readonly y: number;
}

/**
 * The app's registry of node and edge types and their data:
 * `{ nodes: { task: { title: string } }; edges: { dependency: { weight: number } } }`.
 */
export interface FlowTypes {
    /** each node type and the shape of its `data` */
    readonly nodes?: object;
    /** each app edge type and the shape of its `data` (the built-in types may be given too) */
    readonly edges?: object;
}

/** A registry that types nothing: any node type, any edge type, any JSON object as data. */
export interface AnyTypes extends FlowTypes {
    readonly nodes: { readonly [type: string]: Record<string, unknown> };
    readonly edges: { readonly [type: string]: Record<string, unknown> };
}

/** The edge types the core draws (its own path math): any other type is the app's. */
export type BuiltInEdgeType = "bezier" | "smoothstep" | "step" | "straight";

/** The node types of a registry. */
export type NodeTypeOf<T extends FlowTypes> = T extends {
    readonly nodes: infer N extends object;
}
    ? keyof N & string
    : string;

/** The data of a node type. */
export type NodeDataOf<T extends FlowTypes, K extends string> = T extends {
    readonly nodes: infer N extends object;
}
    ? K extends keyof N
        ? N[K]
        : Record<string, unknown>
    : Record<string, unknown>;

/**
 * The edge types of a registry: the built-in ones and the app's. An `any` registry (what Angular's
 * template type-check gives a generic directive) takes every type, as `AnyTypes` does.
 */
export type EdgeTypeOf<T extends FlowTypes> = 0 extends 1 & T
    ? string
    :
          | BuiltInEdgeType
          | (T extends { readonly edges: infer E extends object }
                ? keyof E & string
                : never);

/** The data of an edge type (a built-in type the registry does not name: any JSON object). */
export type EdgeDataOf<T extends FlowTypes, K extends string> = T extends {
    readonly edges: infer E extends object;
}
    ? K extends keyof E
        ? E[K]
        : Record<string, unknown>
    : Record<string, unknown>;

/** A node's permission flags; an absent flag is its default (`hidden` false, the others true). */
export interface NodeFlags {
    /** it may be moved (`node.move`); default true */
    readonly draggable?: boolean;
    /** it may be selected (`selection.set`); default true */
    readonly selectable?: boolean;
    /** edges may start or end at it (`edge.add`, `edge.reconnect`); default true */
    readonly connectable?: boolean;
    /** it may be removed (`node.remove`, `selection.remove`); default true */
    readonly deletable?: boolean;
    /** it is not shown; default false */
    readonly hidden?: boolean;
}

/** An edge's permission flags; an absent flag is its default (`hidden` false, the others true). */
export interface EdgeFlags {
    /** it may be selected (`selection.set`); default true */
    readonly selectable?: boolean;
    /** it may be removed (`edge.remove`, `selection.remove`); default true */
    readonly deletable?: boolean;
    /** it is not shown; default false */
    readonly hidden?: boolean;
    /** its ends may be moved to other nodes (`edge.reconnect`); default true */
    readonly reconnectable?: boolean;
}

/** The fields the `selection()` feature owns on a node and on an edge. */
export interface SelectionFields {
    /** it is selected (`@fragiola/flow/selection`) */
    readonly selected?: boolean;
}

/** The fields the `subflows()` feature owns on a node. */
export interface SubflowFields {
    /** the node it lives in (`@fragiola/flow/subflows`): its `position` is relative to it */
    readonly parentId?: string;
    /** `"parent"`: it stays inside its parent's box (`@fragiola/flow/subflows`) */
    readonly extent?: "parent";
    /** its parent grows to keep it inside when it moves or grows past it (`@fragiola/flow/subflows`) */
    readonly expandParent?: boolean;
}

/** What every node has, whatever its type. */
export interface NodeFields extends NodeFlags, SelectionFields, SubflowFields {
    /** its top-left corner, in flow coordinates (relative to its parent with sub-flows) */
    readonly position: XY;
    /** its width, when the document gives one (the engine measures the rendered one) */
    readonly width?: number;
    /** its height, when the document gives one (the engine measures the rendered one) */
    readonly height?: number;
}

/** A node of type `K` and data `D`. */
export interface NodeOf<K extends string, D> extends NodeFields {
    readonly id: string;
    readonly type: K;
    readonly data: D;
}

/** A node of the registry `T`: a union over its node types, so `type` narrows `data`. */
export type FlowNode<T extends FlowTypes = AnyTypes> = {
    [K in NodeTypeOf<T>]: NodeOf<K, NodeDataOf<T, K>>;
}[NodeTypeOf<T>];

/** What every edge has, whatever its type. */
export interface EdgeFields extends EdgeFlags, SelectionFields {
    /** the node it starts at */
    readonly source: string;
    /** the node it ends at */
    readonly target: string;
    /** the source node's handle it starts at (none: the node's only, or default, source handle) */
    readonly sourceHandle?: string;
    /** the target node's handle it ends at (none: the node's only, or default, target handle) */
    readonly targetHandle?: string;
}

/** An edge of type `K` and data `D`. */
export interface EdgeOf<K extends string, D> extends EdgeFields {
    readonly id: string;
    /** how it is drawn: a built-in path or the app's type; none is `"bezier"` */
    readonly type?: K;
    readonly data?: D;
}

/** An edge of the registry `T`: a union over its edge types, so `type` narrows `data`. */
export type FlowEdge<T extends FlowTypes = AnyTypes> = {
    [K in EdgeTypeOf<T>]: EdgeOf<K, EdgeDataOf<T, K>>;
}[EdgeTypeOf<T>];

/** The document as the model holds it: frozen, every id present. */
export interface FlowDocument<T extends FlowTypes = AnyTypes> {
    readonly version: 1;
    readonly nodes: readonly FlowNode<T>[];
    readonly edges: readonly FlowEdge<T>[];
}

/** A node as a document or `node.add` gives it: its `id` may be left out (one is generated). */
export type FlowNodeInput<T extends FlowTypes = AnyTypes> = {
    [K in NodeTypeOf<T>]: Omit<NodeOf<K, NodeDataOf<T, K>>, "id"> & {
        /** its id; generated (`createId`) when missing */
        readonly id?: string;
    };
}[NodeTypeOf<T>];

/** An edge as a document or `edge.add` gives it: its `id` may be left out (one is generated). */
export type FlowEdgeInput<T extends FlowTypes = AnyTypes> = {
    [K in EdgeTypeOf<T>]: Omit<EdgeOf<K, EdgeDataOf<T, K>>, "id"> & {
        /** its id; generated (`createId`) when missing */
        readonly id?: string;
    };
}[EdgeTypeOf<T>];

/** A flow document as JSON, as `createFlowModel` and `validateFlow` take it (version 1). */
export interface FlowJson<T extends FlowTypes = AnyTypes> {
    version: 1;
    nodes: FlowNodeInput<T>[];
    edges: FlowEdgeInput<T>[];
}

/** A writable copy of the document, every id present: what `get("flow-json")` returns. */
export interface FlowDocumentJson<T extends FlowTypes = AnyTypes> {
    version: 1;
    nodes: FlowNode<T>[];
    edges: FlowEdge<T>[];
}
