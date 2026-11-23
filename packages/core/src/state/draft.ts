// What a command writes to: the committed document, copied on the first write, sharing every node
// and edge it does not touch (`before.nodes[i] === after.nodes[i]` for an untouched node, so an
// app's undo or a view can compare by identity). A dry run throws its draft away.
import type { IdSource } from "../document/create-id";
import type { FlowDocument, FlowEdge, FlowNode } from "../document/types";
import type { FlowReader } from "../features/types";
import { deepFreeze } from "./deep-freeze";
import { recordReplaced } from "./replaced-items";

/** Each entity's index in its list, by id. */
export type EntityIndex = ReadonlyMap<string, number>;

/** A document and the indexes of its nodes and edges: what the model holds and queries read. */
export interface IndexedDocument {
    readonly document: FlowDocument;
    readonly nodeIndex: EntityIndex;
    readonly edgeIndex: EntityIndex;
}

/** The index of a list of entities, by id. */
export function indexOf(list: readonly { readonly id: string }[]): EntityIndex {
    return new Map(list.map((entity, i) => [entity.id, i]));
}

/** A reader of a committed document (no writes, no ids drawn). */
export function readerOf(indexed: IndexedDocument): FlowReader {
    const { document: flow, nodeIndex, edgeIndex } = indexed;
    return {
        nodes: () => flow.nodes,
        edges: () => flow.edges,
        node: (id) => {
            const at = nodeIndex.get(id);
            return at === undefined ? undefined : flow.nodes[at];
        },
        edge: (id) => {
            const at = edgeIndex.get(id);
            return at === undefined ? undefined : flow.edges[at];
        },
    };
}

/** A copy-on-write document: what a command reads and changes. */
export class Draft implements FlowReader {
    readonly ids: IdSource;
    private readonly base: IndexedDocument;
    private nodeList: FlowNode[] | undefined;
    private edgeList: FlowEdge[] | undefined;
    private nodeIds: Map<string, number> | undefined;
    private edgeIds: Map<string, number> | undefined;
    /** the ids replaced in place; none once an item was added or removed */
    private replacedNodes: Set<string> | undefined = new Set();
    private replacedEdges: Set<string> | undefined = new Set();

    constructor(base: IndexedDocument, ids: IdSource) {
        this.base = base;
        this.ids = ids;
    }

    /** Whether a command changed anything. */
    get changed(): boolean {
        return this.nodeList !== undefined || this.edgeList !== undefined;
    }

    /** The nodes, in order. */
    nodes(): readonly FlowNode[] {
        return this.nodeList ?? this.base.document.nodes;
    }

    /** The edges, in order. */
    edges(): readonly FlowEdge[] {
        return this.edgeList ?? this.base.document.edges;
    }

    /** A node by its id. */
    node(id: string): FlowNode | undefined {
        const at = (this.nodeIds ?? this.base.nodeIndex).get(id);
        return at === undefined ? undefined : this.nodes()[at];
    }

    /** An edge by its id. */
    edge(id: string): FlowEdge | undefined {
        const at = (this.edgeIds ?? this.base.edgeIndex).get(id);
        return at === undefined ? undefined : this.edges()[at];
    }

    /** A fresh node id (`createId`). */
    nextNodeId(): string {
        return this.ids.next("node", (id) => this.node(id) !== undefined);
    }

    /** A fresh edge id (`createId`). */
    nextEdgeId(): string {
        return this.ids.next("edge", (id) => this.edge(id) !== undefined);
    }

    /** Appends a node (its id unused) or replaces the node of its id, in place. */
    putNode(node: FlowNode): void {
        const list = this.ownNodes();
        const at = (this.nodeIds ?? this.base.nodeIndex).get(node.id);
        if (at !== undefined) {
            // replaced in place: the index stays the base's (no copy of it per move)
            list[at] = node;
            this.replacedNodes?.add(node.id);
            return;
        }
        this.replacedNodes = undefined;
        const ids = this.nodeIds ?? new Map(this.base.nodeIndex);
        this.nodeIds = ids;
        ids.set(node.id, list.length);
        list.push(node);
    }

    /** Appends an edge (its id unused) or replaces the edge of its id, in place. */
    putEdge(edge: FlowEdge): void {
        const list = this.ownEdges();
        const at = (this.edgeIds ?? this.base.edgeIndex).get(edge.id);
        if (at !== undefined) {
            // replaced in place: the index stays the base's (no copy of it per move)
            list[at] = edge;
            this.replacedEdges?.add(edge.id);
            return;
        }
        this.replacedEdges = undefined;
        const ids = this.edgeIds ?? new Map(this.base.edgeIndex);
        this.edgeIds = ids;
        ids.set(edge.id, list.length);
        list.push(edge);
    }

    /** Removes the nodes of these ids (their edges are the caller's to remove). */
    removeNodes(ids: ReadonlySet<string>): void {
        if (ids.size === 0) {
            return;
        }
        this.replacedNodes = undefined;
        this.nodeList = this.nodes().filter((node) => !ids.has(node.id));
        this.nodeIds = new Map(indexOf(this.nodeList));
    }

    /** Removes the edges of these ids. */
    removeEdges(ids: ReadonlySet<string>): void {
        if (ids.size === 0) {
            return;
        }
        this.replacedEdges = undefined;
        this.edgeList = this.edges().filter((edge) => !ids.has(edge.id));
        this.edgeIds = new Map(indexOf(this.edgeList));
    }

    /** The document the draft holds now, frozen (or the base itself when nothing changed). */
    commit(freeze: boolean): IndexedDocument {
        if (!this.changed) {
            return this.base;
        }
        const flow: FlowDocument = {
            version: 1,
            nodes: this.nodes(),
            edges: this.edges(),
        };
        // what was only replaced in place, for the engine's geometry (replaced-items.ts)
        if (this.nodeList && this.replacedNodes) {
            recordReplaced(
                this.nodeList,
                this.base.document.nodes,
                this.replacedNodes,
            );
        }
        if (this.edgeList && this.replacedEdges) {
            recordReplaced(
                this.edgeList,
                this.base.document.edges,
                this.replacedEdges,
            );
        }
        return {
            document: freeze ? deepFreeze(flow) : flow,
            nodeIndex: this.nodeIds ?? this.base.nodeIndex,
            edgeIndex: this.edgeIds ?? this.base.edgeIndex,
        };
    }

    private ownNodes(): FlowNode[] {
        this.nodeList ??= [...this.base.document.nodes];
        return this.nodeList;
    }

    private ownEdges(): FlowEdge[] {
        this.edgeList ??= [...this.base.document.edges];
        return this.edgeList;
    }
}
