// The engine's geometry, cached (Epic #61, Issue #59): each node's box, size and flags, each edge's
// ends and path, two uniform grids (the shown nodes of known size, the drawable edges by the box
// of their ends) and the lists built from them (`visible-nodes`, `visible-edges`, `drawn-edges`,
// `render-layers`). It follows the document by identity: a read first syncs (the node and edge
// lists compared item by item with the last ones seen, the measurements' touched nodes taken, the
// options compared), and recomputes only the nodes that changed, their descendants (a child stands
// in its parent) and the edges at any of them. So a viewport step costs a grid query, and a drag
// step the moved nodes and their edges. A list keeps its array while its content is unchanged.
// Everything it gives equals a from-scratch computation (tests/engine/geometry-equivalence.test.ts).
import type { FlowEdge, FlowNode, XY } from "../document/types";
import {
    type EdgeEndHandle,
    edgeEnds,
    type PathOptions,
    pathOf,
} from "../geometry/edge-geometry";
import {
    declaredHandleOf,
    matchHandle,
    type NodeLayout,
    nodeRectOf,
    nodeSize,
} from "../geometry/node-layout";
import { boundsOf, contains, sharesArea } from "../geometry/rect";
import { SpatialGrid } from "../geometry/spatial-grid";
import type { EdgePath, PathEnds, Rect } from "../geometry/types";
import {
    drawingOrder,
    edgeStackValue,
    type Layering,
    layersOf,
    layerThresholds,
    type NodeLevels,
    nodeLevels,
    nodeStackValue,
    type Stacked,
    type ZIndexMode,
} from "../geometry/z-order";
import type { FlowModel } from "../model/create-flow-model";
import type { HandleType } from "../state/queries";
import { replacedSince } from "../state/replaced-items";
import type { FlowHandle } from "./adapter";
import type { Measurements } from "./measurements";

/** The engine options the geometry reads. */
export interface GeometryOptions {
    readonly nodeOrigin?: XY | undefined;
    readonly pathOptions?: PathOptions | undefined;
    readonly zIndexMode?: ZIndexMode | undefined;
    readonly elevateNodesOnSelect?: boolean | undefined;
    readonly elevateEdgesOnSelect?: boolean | undefined;
}

/** What the geometry reads: the model's document, the measurements and the engine's options. */
export interface GeometrySource {
    readonly model: FlowModel;
    readonly measurements: Measurements;
    options(): GeometryOptions;
}

/** Whether the shown nodes are sized and measured (`ready`, the fit on init). */
export interface Readiness {
    /** how many nodes are shown */
    readonly shown: number;
    /** every shown node has a size (given, measured or initial) */
    readonly sized: boolean;
    /** every shown node is measured or given its size (`node-measured`) */
    readonly measured: boolean;
}

interface NodeEntry {
    readonly node: FlowNode;
    /** its absolute box, its size zero until known (`node-rect-by`) */
    readonly box: Rect;
    /** its size is known: given, measured or initial */
    readonly known: boolean;
    /** its size is measured or given (`node-measured`) */
    readonly measured: boolean;
    /** it is not hidden */
    readonly shown: boolean;
}

interface EdgeEntry {
    readonly edge: FlowEdge;
    /** its ends, once both its nodes have a size */
    readonly ends: PathEnds | undefined;
    /** it is drawn (not hidden, its nodes shown and sized) */
    readonly drawable: boolean;
    /** its path, built when first read for the current path options */
    path: EdgePath | undefined;
    pathVersion: number;
}

interface Memo<K, V> {
    readonly key: K;
    readonly value: V;
}

const EMPTY: readonly never[] = Object.freeze([]);

/** Whether a node's change moves its stack value or its place in the drawing (not its geometry). */
function stackChanged(a: FlowNode, b: FlowNode): boolean {
    return (
        a.hidden !== b.hidden ||
        a.zIndex !== b.zIndex ||
        a.selected !== b.selected ||
        a.parentId !== b.parentId
    );
}

/** The same items, in the same order. */
function sameItems<V>(a: readonly V[], b: readonly V[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

/** Shallow equality of two option records (path options), absent ones equal. */
function sameRecord(a: object | undefined, b: object | undefined): boolean {
    if (a === b) return true;
    const left: Readonly<Record<string, unknown>> = { ...a };
    const right: Readonly<Record<string, unknown>> = { ...b };
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) if (left[key] !== right[key]) return false;
    return true;
}

/** The engine's cached geometry: see the file's header. */
export class EngineGeometry {
    private readonly source: GeometrySource;
    private nodes: readonly FlowNode[] = EMPTY;
    private edges: readonly FlowEdge[] = EMPTY;
    private readonly nodeIndex = new Map<string, number>();
    private readonly edgeIndex = new Map<string, number>();
    private readonly nodeEntries = new Map<string, NodeEntry>();
    private readonly edgeEntries = new Map<string, EdgeEntry>();
    /** each parent id's children ids */
    private readonly children = new Map<string, Set<string>>();
    /** each node id's edges (either end) */
    private readonly edgesAt = new Map<string, Set<string>>();
    /** the shown nodes of known size, by their box */
    private readonly nodeGrid = new SpatialGrid();
    /** the drawable edges, by the box of their ends */
    private readonly edgeGrid = new SpatialGrid();
    /** the shown nodes of unknown size (always in view) */
    private readonly unsized = new Set<string>();
    private shownCount = 0;
    private unsizedCount = 0;
    private unmeasuredCount = 0;
    private seenOptions: GeometryOptions | undefined;
    private origin: { x: number; y: number } | undefined;
    private pathOptions: PathOptions | undefined;
    private stackOptions = "";
    /** the whole geometry is to be recomputed (the first read, an origin change) */
    private stale = true;
    /** bumped when stack values or the drawn edges' membership may change */
    private orderVersion = 0;
    /** bumped when a node's box may change */
    private shapeVersion = 0;
    /** bumped when the path options change */
    private pathVersion = 0;
    /** bumped when an edge's entry may change */
    private edgeVersion = 0;
    /** the view and versions the last `visible-nodes` / `visible-edges` were worked out for */
    private visibleNodesKey = "";
    private visibleEdgesKey = "";
    private readonly nodeValues = new Map<
        string,
        { version: number; value: number }
    >();
    private readonly edgeValues = new Map<
        string,
        { version: number; value: number }
    >();
    private shownMemo:
        | Memo<readonly FlowNode[], readonly FlowNode[]>
        | undefined;
    private drawableMemo:
        | Memo<readonly [readonly FlowEdge[], number], readonly FlowEdge[]>
        | undefined;
    private drawnMemo:
        | Memo<readonly [readonly FlowEdge[], number], readonly FlowEdge[]>
        | undefined;
    private nodePartMemo:
        | Memo<
              number,
              {
                  readonly stacked: readonly Stacked[];
                  readonly lowest: number;
              }
          >
        | undefined;
    private levelsMemo: Memo<readonly [object, string], NodeLevels> | undefined;
    private layeringMemo:
        | Memo<readonly [object, readonly FlowEdge[], ZIndexMode], Layering>
        | undefined;
    private boundsMemo: Memo<number, Rect | undefined> | undefined;
    private lastVisibleNodes: readonly FlowNode[] = EMPTY;
    private lastVisibleEdges: readonly FlowEdge[] = EMPTY;
    private lastDrawn: readonly FlowEdge[] = EMPTY;

    /** The layout the pure node helpers read: the synced nodes, their sizes, the origin. */
    private readonly layout: NodeLayout;

    constructor(source: GeometrySource) {
        this.source = source;
        const geometry = this;
        this.layout = {
            node: (nodeId) => this.nodeById(nodeId),
            size: (node) => this.sizeOf(node),
            get nodeOrigin() {
                return geometry.source.options().nodeOrigin;
            },
        };
    }

    /**
     * Drops every cache (the engine's `destroy`): its maps, grids and lists. A later read builds
     * them again from the document, as the first read does.
     */
    release(): void {
        this.nodes = EMPTY;
        this.edges = EMPTY;
        this.nodeIndex.clear();
        this.edgeIndex.clear();
        this.nodeEntries.clear();
        this.edgeEntries.clear();
        this.children.clear();
        this.edgesAt.clear();
        this.nodeGrid.clear();
        this.edgeGrid.clear();
        this.unsized.clear();
        this.nodeValues.clear();
        this.edgeValues.clear();
        this.shownCount = 0;
        this.unsizedCount = 0;
        this.unmeasuredCount = 0;
        this.stale = true;
        this.visibleNodesKey = "";
        this.visibleEdgesKey = "";
        this.shownMemo = undefined;
        this.drawableMemo = undefined;
        this.drawnMemo = undefined;
        this.nodePartMemo = undefined;
        this.levelsMemo = undefined;
        this.layeringMemo = undefined;
        this.boundsMemo = undefined;
        this.lastVisibleNodes = EMPTY;
        this.lastVisibleEdges = EMPTY;
        this.lastDrawn = EMPTY;
    }

    // ---------------------------------------------------------------------------------------------
    // reads
    // ---------------------------------------------------------------------------------------------

    /** A node of the document by id (the synced document's). */
    node(nodeId: string): FlowNode | undefined {
        this.sync();
        return this.nodeById(nodeId);
    }

    /** An edge of the document by id (the synced document's). */
    edge(edgeId: string): FlowEdge | undefined {
        this.sync();
        const at = this.edgeIndex.get(edgeId);
        return at === undefined ? undefined : this.edges[at];
    }

    /** A node's absolute box, its size zero until known (`node-rect-by`). */
    box(nodeId: string): Rect | undefined {
        this.sync();
        return this.nodeEntries.get(nodeId)?.box;
    }

    /** A node's absolute box once its size is known. */
    knownRect(nodeId: string): Rect | undefined {
        this.sync();
        const entry = this.nodeEntries.get(nodeId);
        return entry?.known ? entry.box : undefined;
    }

    /** The box of a node object: the cached one when it is the document's, else computed. */
    boxOf(node: FlowNode): Rect {
        this.sync();
        const entry = this.nodeEntries.get(node.id);
        return entry?.node === node ? entry.box : nodeRectOf(node, this.layout);
    }

    /** A registered handle with its absolute centre (once it and its node are measured). */
    placed(handle: FlowHandle): FlowHandle {
        if (!handle.bounds) return handle;
        const rect = this.box(handle.nodeId);
        if (!rect) return handle;
        return {
            ...handle,
            center: {
                x: rect.x + handle.bounds.x + handle.bounds.width / 2,
                y: rect.y + handle.bounds.y + handle.bounds.height / 2,
            },
        };
    }

    /** An edge's ends and path (`edge-path-by`), once both its nodes have a size. */
    edgePath(edgeId: string): EdgePath | undefined {
        this.sync();
        const entry = this.edgeEntries.get(edgeId);
        if (!entry?.ends) return undefined;
        if (!entry.path || entry.pathVersion !== this.pathVersion) {
            const path = pathOf(entry.edge.type, entry.ends, {
                ...this.pathOptions,
                ...entry.edge.pathOptions,
            });
            entry.path = Object.freeze(path);
            entry.pathVersion = this.pathVersion;
        }
        return entry.path;
    }

    /** A node's stack value by the `zIndexMode` (`nodeStackValue`). */
    nodeValue(node: FlowNode): number {
        this.sync();
        const cached = this.nodeValues.get(node.id);
        if (
            cached?.version === this.orderVersion &&
            this.nodeById(node.id) === node
        ) {
            return cached.value;
        }
        const value = nodeStackValue(
            node,
            (id) => this.nodeById(id),
            this.source.options(),
        );
        if (this.nodeById(node.id) === node) {
            this.nodeValues.set(node.id, { version: this.orderVersion, value });
        }
        return value;
    }

    /** An edge's stack value by the `zIndexMode` (`edgeStackValue`). */
    edgeValue(edge: FlowEdge): number {
        this.sync();
        const cached = this.edgeValues.get(edge.id);
        const current = this.edgeEntries.get(edge.id)?.edge === edge;
        if (cached?.version === this.orderVersion && current) {
            return cached.value;
        }
        const value = edgeStackValue(
            edge,
            (id) => this.nodeById(id),
            this.source.options(),
        );
        if (current) {
            this.edgeValues.set(edge.id, { version: this.orderVersion, value });
        }
        return value;
    }

    /**
     * The shown nodes in `view` (and those of unknown size), in the document's order; every shown
     * node without a view, none when `culled` (`onlyRenderVisible`: nothing mounts before the root
     * has a size).
     */
    visibleNodes(view: Rect | undefined, culled: boolean): readonly FlowNode[] {
        this.sync();
        if (!view) return culled ? EMPTY : this.shownNodes();
        // a read per node and per edge: the list is worked out once per view and change
        const key = `${view.x},${view.y},${view.width},${view.height}|${this.shapeVersion}`;
        if (key === this.visibleNodesKey) return this.lastVisibleNodes;
        this.visibleNodesKey = key;
        const indexes: number[] = [];
        for (const id of this.nodeGrid.query(view)) {
            const at = this.nodeIndex.get(id);
            if (at !== undefined) indexes.push(at);
        }
        for (const id of this.unsized) {
            const at = this.nodeIndex.get(id);
            if (at !== undefined) indexes.push(at);
        }
        indexes.sort((a, b) => a - b);
        const list = indexes.map((at) => this.nodes[at] as FlowNode);
        if (sameItems(list, this.lastVisibleNodes))
            return this.lastVisibleNodes;
        this.lastVisibleNodes = Object.freeze(list);
        return this.lastVisibleNodes;
    }

    /**
     * The drawable edges whose ends' box meets `view`, in the document's order; every drawable
     * edge without a view, none when `culled`.
     */
    visibleEdges(view: Rect | undefined, culled: boolean): readonly FlowEdge[] {
        this.sync();
        if (!view) return culled ? EMPTY : this.drawableEdges();
        const key = `${view.x},${view.y},${view.width},${view.height}|${this.edgeVersion}`;
        if (key === this.visibleEdgesKey) return this.lastVisibleEdges;
        this.visibleEdgesKey = key;
        const indexes: number[] = [];
        for (const id of this.edgeGrid.query(view)) {
            const at = this.edgeIndex.get(id);
            if (at !== undefined) indexes.push(at);
        }
        indexes.sort((a, b) => a - b);
        const list = indexes.map((at) => this.edges[at] as FlowEdge);
        if (sameItems(list, this.lastVisibleEdges))
            return this.lastVisibleEdges;
        this.lastVisibleEdges = Object.freeze(list);
        return this.lastVisibleEdges;
    }

    /**
     * The edges to draw, in drawing order: the drawable ones (in `view` when `culled`), by their
     * stack value, the document's order among equals.
     */
    drawnEdges(view: Rect | undefined, culled: boolean): readonly FlowEdge[] {
        this.sync();
        const shown = culled
            ? this.visibleEdges(view, true)
            : this.drawableEdges();
        const memo = this.drawnMemo;
        if (memo?.key[0] === shown && memo.key[1] === this.orderVersion) {
            return memo.value;
        }
        const ordered = drawingOrder(shown, (edge) => this.edgeValue(edge));
        const value = sameItems(ordered, this.lastDrawn)
            ? this.lastDrawn
            : Object.freeze(ordered);
        this.lastDrawn = value;
        this.drawnMemo = { key: [shown, this.orderVersion], value };
        return value;
    }

    /** The render layers (`render-layers`) of the shown nodes and the drawn edges. */
    layering(view: Rect | undefined, culled: boolean): Layering {
        this.sync();
        const drawn = this.drawnEdges(view, culled);
        const part = this.nodePart();
        const mode = this.source.options().zIndexMode ?? "auto";
        const memo = this.layeringMemo;
        if (
            memo?.key[0] === part &&
            memo.key[1] === drawn &&
            memo.key[2] === mode
        ) {
            return memo.value;
        }
        const edges = drawn.map((edge) => ({
            id: edge.id,
            value: this.edgeValue(edge),
        }));
        const thresholds =
            mode === "basic" || part.stacked.length === 0
                ? []
                : layerThresholds(part.lowest, edges);
        const key = thresholds.join(",");
        let levels = this.levelsMemo;
        if (levels?.key[0] !== part || levels.key[1] !== key) {
            levels = {
                key: [part, key],
                value: nodeLevels(part.stacked, thresholds),
            };
            this.levelsMemo = levels;
        }
        const value = layersOf(levels.value, edges);
        this.layeringMemo = { key: [part, drawn, mode], value };
        return value;
    }

    /**
     * The shown nodes of known size sharing area with `area` (`partial: false`: inside it), but
     * `nodeId`, in the document's order (`intersecting-nodes`).
     */
    intersecting(
        area: Rect,
        nodeId: string | undefined,
        partial: boolean,
    ): readonly FlowNode[] {
        this.sync();
        const indexes: number[] = [];
        for (const id of this.nodeGrid.query(area)) {
            if (id === nodeId) continue;
            const box = this.nodeEntries.get(id)?.box;
            if (!box) continue;
            if (!(partial ? sharesArea(box, area) : contains(area, box)))
                continue;
            const at = this.nodeIndex.get(id);
            if (at !== undefined) indexes.push(at);
        }
        indexes.sort((a, b) => a - b);
        return indexes.map((at) => this.nodes[at] as FlowNode);
    }

    /** The bounds of every node of known size: the shown ones, or the hidden ones too. */
    bounds(includeHidden: boolean): Rect | undefined {
        this.sync();
        if (includeHidden) {
            const rects: Rect[] = [];
            for (const entry of this.nodeEntries.values()) {
                if (entry.known) rects.push(entry.box);
            }
            return boundsOf(rects);
        }
        if (this.boundsMemo?.key !== this.shapeVersion) {
            const rects: Rect[] = [];
            for (const id of this.nodeGrid.ids()) {
                const box = this.nodeGrid.get(id);
                if (box) rects.push(box);
            }
            this.boundsMemo = {
                key: this.shapeVersion,
                value: boundsOf(rects),
            };
        }
        const value = this.boundsMemo.value;
        return value ? { ...value } : undefined;
    }

    /** Whether the shown nodes are sized and measured (counted as they change). */
    readiness(): Readiness {
        this.sync();
        return {
            shown: this.shownCount,
            sized: this.unsizedCount === 0,
            measured: this.unmeasuredCount === 0,
        };
    }

    // ---------------------------------------------------------------------------------------------
    // the cached lists
    // ---------------------------------------------------------------------------------------------

    /** Every shown node, in the document's order. */
    private shownNodes(): readonly FlowNode[] {
        if (this.shownMemo?.key !== this.nodes) {
            this.shownMemo = {
                key: this.nodes,
                value: Object.freeze(
                    this.nodes.filter((node) => node.hidden !== true),
                ),
            };
        }
        return this.shownMemo.value;
    }

    /** Every drawable edge, in the document's order. */
    private drawableEdges(): readonly FlowEdge[] {
        const memo = this.drawableMemo;
        if (memo?.key[0] === this.edges && memo.key[1] === this.orderVersion) {
            return memo.value;
        }
        const value = Object.freeze(
            this.edges.filter(
                (edge) => this.edgeEntries.get(edge.id)?.drawable === true,
            ),
        );
        this.drawableMemo = { key: [this.edges, this.orderVersion], value };
        return value;
    }

    /** The shown nodes with their stack values and the lowest of them, per order version. */
    private nodePart() {
        this.sync();
        if (this.nodePartMemo?.key !== this.orderVersion) {
            const stacked = this.shownNodes().map((node) => ({
                id: node.id,
                value: this.nodeValue(node),
            }));
            this.nodePartMemo = {
                key: this.orderVersion,
                value: {
                    stacked,
                    lowest: stacked.reduce(
                        (least, node) => Math.min(least, node.value),
                        Number.POSITIVE_INFINITY,
                    ),
                },
            };
        }
        return this.nodePartMemo.value;
    }

    // ---------------------------------------------------------------------------------------------
    // the sync
    // ---------------------------------------------------------------------------------------------

    private nodeById(nodeId: string): FlowNode | undefined {
        const at = this.nodeIndex.get(nodeId);
        return at === undefined ? undefined : this.nodes[at];
    }

    /** A node's measured size, when it has some (an empty one is not). */
    private measuredSize(nodeId: string) {
        const measured = this.source.measurements.size(nodeId);
        return measured && (measured.width > 0 || measured.height > 0)
            ? measured
            : undefined;
    }

    private sizeOf(node: FlowNode) {
        return nodeSize(node, this.measuredSize(node.id));
    }

    /** Brings the caches to the model's document, the measurements and the options. */
    private sync(): void {
        const options = this.source.options();
        if (options !== this.seenOptions) this.syncOptions(options);
        const { model, measurements } = this.source;
        const nodes = model.get("all-nodes");
        const edges = model.get("all-edges");
        const touched = measurements.takeTouched();
        if (
            !this.stale &&
            nodes === this.nodes &&
            edges === this.edges &&
            !touched
        ) {
            return;
        }
        let full = this.stale;
        this.stale = false;
        const dirty = new Set<string>();
        if (nodes !== this.nodes) {
            // the commits since the last sync only replaced these nodes: no need to compare all
            const replaced = full
                ? undefined
                : replacedSince(nodes, this.nodes);
            const changed = (before: FlowNode, after: FlowNode) => {
                dirty.add(after.id);
                if (stackChanged(before, after)) this.orderVersion++;
                if (before.parentId !== after.parentId) {
                    this.unparent(after.id, before.parentId);
                    this.parent(after.id, after.parentId);
                }
            };
            if (replaced) {
                for (const id of replaced) {
                    const at = this.nodeIndex.get(id);
                    const before =
                        at === undefined ? undefined : this.nodes[at];
                    const after = at === undefined ? undefined : nodes[at];
                    if (!before || !after || before.id !== after.id) {
                        full = true;
                        break;
                    }
                    if (before !== after) changed(before, after);
                }
            } else if (full || nodes.length !== this.nodes.length) {
                full = true;
            } else {
                for (let i = 0; i < nodes.length; i++) {
                    const before = this.nodes[i] as FlowNode;
                    const after = nodes[i] as FlowNode;
                    if (before === after) continue;
                    if (before.id !== after.id) {
                        full = true;
                        break;
                    }
                    changed(before, after);
                }
            }
            this.nodes = nodes;
        }
        const dirtyEdges = new Set<string>();
        let fullEdges = full;
        if (full) {
            this.rebuildNodes();
        } else {
            if (touched) {
                for (const id of touched) {
                    if (this.nodeIndex.has(id)) dirty.add(id);
                }
            }
            // a child stands in its parent: its box follows
            for (const id of dirty) {
                for (const child of this.children.get(id) ?? [])
                    dirty.add(child);
            }
            for (const id of dirty) {
                this.updateNode(id);
                for (const edgeId of this.edgesAt.get(id) ?? []) {
                    dirtyEdges.add(edgeId);
                }
            }
        }
        if (edges !== this.edges) {
            const replaced = fullEdges
                ? undefined
                : replacedSince(edges, this.edges);
            const changed = (before: FlowEdge, after: FlowEdge) => {
                dirtyEdges.add(after.id);
                if (
                    before.source !== after.source ||
                    before.target !== after.target
                ) {
                    this.detach(after.id, before);
                    this.attach(after.id, after);
                }
            };
            if (replaced) {
                for (const id of replaced) {
                    const at = this.edgeIndex.get(id);
                    const before =
                        at === undefined ? undefined : this.edges[at];
                    const after = at === undefined ? undefined : edges[at];
                    if (!before || !after || before.id !== after.id) {
                        fullEdges = true;
                        break;
                    }
                    if (before !== after) changed(before, after);
                }
            } else if (!fullEdges && edges.length === this.edges.length) {
                for (let i = 0; i < edges.length; i++) {
                    const before = this.edges[i] as FlowEdge;
                    const after = edges[i] as FlowEdge;
                    if (before === after) continue;
                    if (before.id !== after.id) {
                        fullEdges = true;
                        break;
                    }
                    changed(before, after);
                }
            } else {
                fullEdges = true;
            }
            this.orderVersion++;
            this.edges = edges;
        }
        if (fullEdges) {
            this.rebuildEdges();
        } else {
            for (const id of dirtyEdges) this.updateEdge(id);
        }
    }

    private syncOptions(options: GeometryOptions): void {
        this.seenOptions = options;
        const origin = options.nodeOrigin;
        if (origin?.x !== this.origin?.x || origin?.y !== this.origin?.y) {
            this.origin = origin ? { x: origin.x, y: origin.y } : undefined;
            this.stale = true;
        }
        if (!sameRecord(options.pathOptions, this.pathOptions)) {
            this.pathOptions = options.pathOptions
                ? { ...options.pathOptions }
                : undefined;
            this.pathVersion++;
        }
        const stack = `${options.zIndexMode}|${options.elevateNodesOnSelect}|${options.elevateEdgesOnSelect}`;
        if (stack !== this.stackOptions) {
            this.stackOptions = stack;
            this.orderVersion++;
        }
    }

    private parent(nodeId: string, parentId: string | undefined): void {
        if (parentId === undefined) return;
        let set = this.children.get(parentId);
        if (!set) {
            set = new Set();
            this.children.set(parentId, set);
        }
        set.add(nodeId);
    }

    private unparent(nodeId: string, parentId: string | undefined): void {
        if (parentId === undefined) return;
        const set = this.children.get(parentId);
        set?.delete(nodeId);
        if (set?.size === 0) this.children.delete(parentId);
    }

    private attach(edgeId: string, edge: FlowEdge): void {
        for (const nodeId of [edge.source, edge.target]) {
            let set = this.edgesAt.get(nodeId);
            if (!set) {
                set = new Set();
                this.edgesAt.set(nodeId, set);
            }
            set.add(edgeId);
        }
    }

    private detach(edgeId: string, edge: FlowEdge): void {
        for (const nodeId of [edge.source, edge.target]) {
            const set = this.edgesAt.get(nodeId);
            set?.delete(edgeId);
            if (set?.size === 0) this.edgesAt.delete(nodeId);
        }
    }

    private rebuildNodes(): void {
        this.nodeIndex.clear();
        this.nodeEntries.clear();
        this.children.clear();
        this.nodeGrid.clear();
        this.unsized.clear();
        this.nodeValues.clear();
        this.shownCount = 0;
        this.unsizedCount = 0;
        this.unmeasuredCount = 0;
        this.nodes.forEach((node, i) => {
            this.nodeIndex.set(node.id, i);
            this.parent(node.id, node.parentId);
        });
        for (const node of this.nodes) this.updateNode(node.id);
        this.orderVersion++;
        this.shapeVersion++;
    }

    private rebuildEdges(): void {
        this.edgeIndex.clear();
        this.edgeEntries.clear();
        this.edgesAt.clear();
        this.edgeGrid.clear();
        this.edgeValues.clear();
        this.edges.forEach((edge, i) => {
            this.edgeIndex.set(edge.id, i);
            this.attach(edge.id, edge);
        });
        for (const edge of this.edges) this.updateEdge(edge.id);
        this.orderVersion++;
        this.edgeVersion++;
    }

    /** Recomputes a node's entry, files it in the grid, and counts it. */
    private updateNode(nodeId: string): void {
        const node = this.nodeById(nodeId);
        const before = this.nodeEntries.get(nodeId);
        if (before) {
            if (before.shown) {
                this.shownCount--;
                if (!before.known) this.unsizedCount--;
                if (!before.measured) this.unmeasuredCount--;
            }
        }
        if (!node) {
            this.shapeVersion++;
            this.nodeEntries.delete(nodeId);
            this.nodeGrid.delete(nodeId);
            this.unsized.delete(nodeId);
            return;
        }
        const measured = this.measuredSize(nodeId);
        const known = nodeSize(node, measured) !== undefined;
        const entry: NodeEntry = {
            node,
            box: Object.freeze(nodeRectOf(node, this.layout)),
            known,
            measured:
                (node.width ?? measured?.width) !== undefined &&
                (node.height ?? measured?.height) !== undefined,
            shown: node.hidden !== true,
        };
        this.nodeEntries.set(nodeId, entry);
        this.shapeVersion++;
        if (before && before.known !== entry.known) this.orderVersion++;
        if (entry.shown) {
            this.shownCount++;
            if (!entry.known) this.unsizedCount++;
            if (!entry.measured) this.unmeasuredCount++;
        }
        if (entry.shown && entry.known) this.nodeGrid.set(nodeId, entry.box);
        else this.nodeGrid.delete(nodeId);
        if (entry.shown && !entry.known) this.unsized.add(nodeId);
        else this.unsized.delete(nodeId);
    }

    /** Recomputes an edge's ends and files it in the grid when it is drawable. */
    private updateEdge(edgeId: string): void {
        const at = this.edgeIndex.get(edgeId);
        const edge = at === undefined ? undefined : this.edges[at];
        const before = this.edgeEntries.get(edgeId);
        if (!edge) {
            this.edgeVersion++;
            this.edgeEntries.delete(edgeId);
            this.edgeGrid.delete(edgeId);
            return;
        }
        const ends = edgeEnds(edge, {
            rect: (nodeId) => {
                const entry = this.nodeEntries.get(nodeId);
                return entry?.known ? entry.box : undefined;
            },
            // a measured handle, else one the node declares (used until it is measured)
            handle: (nodeId, type, handleId) =>
                this.measuredHandle(nodeId, type, handleId) ??
                this.declaredHandle(nodeId, type, handleId),
            side: (nodeId, type) => {
                const node = this.nodeById(nodeId);
                return type === "source"
                    ? node?.sourcePosition
                    : node?.targetPosition;
            },
        });
        const drawable =
            ends !== undefined &&
            edge.hidden !== true &&
            this.nodeById(edge.source)?.hidden !== true &&
            this.nodeById(edge.target)?.hidden !== true;
        this.edgeVersion++;
        this.edgeEntries.set(edgeId, {
            edge,
            ends,
            drawable,
            path: undefined,
            pathVersion: this.pathVersion,
        });
        if (before && before.drawable !== drawable) this.orderVersion++;
        if (drawable && ends) {
            const x = Math.min(ends.source.x, ends.target.x);
            const y = Math.min(ends.source.y, ends.target.y);
            this.edgeGrid.set(edgeId, {
                x,
                y,
                width: Math.max(ends.source.x, ends.target.x) - x,
                height: Math.max(ends.source.y, ends.target.y) - y,
            });
        } else {
            this.edgeGrid.delete(edgeId);
        }
    }

    private measuredHandle(
        nodeId: string,
        type: HandleType,
        handleId: string | undefined,
    ): FlowHandle | undefined {
        const found = matchHandle(
            this.source.measurements.handlesOf(nodeId),
            type,
            handleId,
        );
        if (!found?.bounds) return found;
        const rect = this.nodeEntries.get(nodeId)?.box;
        if (!rect) return found;
        return {
            ...found,
            center: {
                x: rect.x + found.bounds.x + found.bounds.width / 2,
                y: rect.y + found.bounds.y + found.bounds.height / 2,
            },
        };
    }

    private declaredHandle(
        nodeId: string,
        type: HandleType,
        handleId: string | undefined,
    ): EdgeEndHandle | undefined {
        const node = this.nodeById(nodeId);
        const entry = this.nodeEntries.get(nodeId);
        return node && entry?.known
            ? declaredHandleOf(node, entry.box, type, handleId)
            : undefined;
    }
}
