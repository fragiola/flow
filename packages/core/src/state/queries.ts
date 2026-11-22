// The typed registry of `get` / `is` keys (Dockable's, fragiola/dockable,
// packages/core/src/state/queries.ts, same author and licence). A `get` key names its result; one
// that takes an id ends in `-by` (`node-by { id }`, `node-edges-by { nodeId }`). An `is` key is
// the question after "is" (`node-draggable { nodeId }`). A feature's keys are typed here too and
// answered by the feature (`FEATURE_KEYS` says whose they are).
import type { BatchEntry, CommandInfo } from "../commands/types";
import type {
    AnyTypes,
    FlowDocumentJson,
    FlowEdge,
    FlowEdgeInput,
    FlowNode,
    FlowNodeInput,
    FlowTypes,
    XY,
} from "../document/types";

/** The payload of a key that takes none. */
export type NoPayload = Record<never, never>;

/**
 * The payload argument of a key: optional when the payload has no required field
 * (`model.get("all-nodes")`), required otherwise (`model.get("node-by", { id })`).
 */
export type QueryArgs<P> = NoPayload extends P ? [payload?: P] : [payload: P];

/** Which end of an edge a handle is: where it starts (`source`) or ends (`target`). */
export type HandleType = "source" | "target";

/** What `model.get(key, payload)` reads: each key's payload and result. */
export interface ModelGetMap<T extends FlowTypes = AnyTypes> {
    /** a node by its id (O(1)) */
    "node-by": { payload: { id: string }; result: FlowNode<T> | undefined };
    /** an edge by its id (O(1)) */
    "edge-by": { payload: { id: string }; result: FlowEdge<T> | undefined };
    /** every node, in drawing order (the document's own frozen list) */
    "all-nodes": { payload: NoPayload; result: readonly FlowNode<T>[] };
    /** every edge, in drawing order (the document's own frozen list) */
    "all-edges": { payload: NoPayload; result: readonly FlowEdge<T>[] };
    /**
     * the edges that start or end at a node; with `handleType`, only those that start
     * (`"source"`) or end (`"target"`) there; with `handleId`, only those at that handle
     */
    "node-edges-by": {
        payload: {
            nodeId: string;
            handleType?: HandleType | undefined;
            handleId?: string | undefined;
        };
        result: readonly FlowEdge<T>[];
    };
    /** the edges that touch any of the nodes (an edge between two of them once) */
    "connected-edges-by": {
        payload: { nodeIds: readonly string[] };
        result: readonly FlowEdge<T>[];
    };
    /**
     * the nodes edges come from into a node (the sources of the edges that end at it), in the
     * document's order, each once; a self loop makes it its own
     */
    "incomers-by": {
        payload: { nodeId: string };
        result: readonly FlowNode<T>[];
    };
    /**
     * the nodes a node's edges go to (the targets of the edges that start at it), in the
     * document's order, each once; a self loop makes it its own
     */
    "outgoers-by": {
        payload: { nodeId: string };
        result: readonly FlowNode<T>[];
    };
    /** a node's position in flow coordinates (with sub-flows: its parents' positions added) */
    "absolute-position-by": {
        payload: { nodeId: string };
        result: XY | undefined;
    };
    /** the selected nodes, in drawing order (`selection()`) */
    "selected-nodes": { payload: NoPayload; result: readonly FlowNode<T>[] };
    /** the selected edges, in drawing order (`selection()`) */
    "selected-edges": { payload: NoPayload; result: readonly FlowEdge<T>[] };
    /** a node's children, in drawing order (`subflows()`) */
    "node-children-by": {
        payload: { nodeId: string };
        result: readonly FlowNode<T>[];
    };
    /** a node's parent (`subflows()`) */
    "node-parent-by": {
        payload: { nodeId: string };
        result: FlowNode<T> | undefined;
    };
    /** the flow as a JSON v1 document: a writable copy, every id present (what `createFlowModel` takes) */
    "flow-json": { payload: NoPayload; result: FlowDocumentJson<T> };
    /** every installed command with its description and JSON Schemas */
    commands: { payload: NoPayload; result: readonly CommandInfo[] };
    /**
     * the commands that turn the document into one with these nodes and edges (a list left out
     * stays as it is), for `batch`: what an adapter runs for its controlled `nodes` / `edges`
     * props. Each difference is the command a user would have run (`node.move`, `edge.add`,
     * `selection.set`, …), a flag that stops a user (`draggable`, `deletable`, `connectable`)
     * unlocked for its step only; what no command expresses (a node's type, a removed data key)
     * removes and adds the entity again with its id. Entities without an id are added; the
     * drawing order is not synced
     */
    "commands-to": {
        payload: {
            nodes?: readonly FlowNodeInput<T>[] | undefined;
            edges?: readonly FlowEdgeInput<T>[] | undefined;
        };
        result: readonly BatchEntry<T>[];
    };
}

/** A key of `model.get`. */
export type ModelGetKey = keyof ModelGetMap;

/** The payload of `model.get(K)`. */
export type ModelGetPayload<
    T extends FlowTypes,
    K extends ModelGetKey,
> = ModelGetMap<T>[K]["payload"];

/** The result of `model.get(K)`. */
export type ModelGetResult<
    T extends FlowTypes,
    K extends ModelGetKey,
> = ModelGetMap<T>[K]["result"];

/** What `model.is(key, payload)` asks: each question's payload. */
export interface ModelIsMap {
    /** a node may be moved (`draggable`, default true) */
    "node-draggable": { nodeId: string };
    /** a node may be selected (`selectable`, default true) */
    "node-selectable": { nodeId: string };
    /** edges may start or end at a node (`connectable`, default true) */
    "node-connectable": { nodeId: string };
    /** a node may be removed (`deletable`, default true) */
    "node-deletable": { nodeId: string };
    /** a node is hidden (`hidden`, default false) */
    "node-hidden": { nodeId: string };
    /** an edge may be selected (`selectable`, default true) */
    "edge-selectable": { edgeId: string };
    /** an edge may be removed (`deletable`, default true) */
    "edge-deletable": { edgeId: string };
    /** an edge is hidden (`hidden`, default false) */
    "edge-hidden": { edgeId: string };
    /** an edge's ends may be moved (`reconnectable`, default true) */
    "edge-reconnectable": { edgeId: string };
    /** a node is selected (`selection()`) */
    "node-selected": { nodeId: string };
    /** an edge is selected (`selection()`) */
    "edge-selected": { edgeId: string };
}

/** A key of `model.is`. */
export type ModelIsKey = keyof ModelIsMap;

/** The payload of `model.is(K)`. */
export type ModelIsPayload<K extends ModelIsKey> = ModelIsMap[K];
