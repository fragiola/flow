// `get("commands-to", { nodes?, edges? })`: the commands that turn the document into one with
// these nodes and edges, the way an adapter's controlled `nodes` / `edges` props reach the model.
// Each difference becomes the command a user's action would have run (`node.move`, `edge.add`,
// `selection.set`, …), so middleware, listeners and undo see ordinary commands. The props are the
// app's document, so a flag that stops a user (`draggable`, `deletable`, `connectable`) does not
// stop them: the step is unlocked and locked again in the same batch; a middleware still vetoes.
// Every adapter asks the core, so none re-implements the diff. What no command can express (a
// node's type, a removed data key, a size given back to measurement) replaces the entity: removed
// and added again with the same id, its edges with it. The drawing order is not synced.
import type { BatchEntry } from "../commands/types";
import { edgeFlag, nodeFlag, reconnectableEnd } from "../document/flags";
import type {
    EdgeFlags,
    FlowEdge,
    FlowEdgeInput,
    FlowNode,
    FlowNodeInput,
    NodeFlags,
} from "../document/types";
import type { FlowReader } from "../features/types";
import { cloneJson } from "./clone-json";

/** What `commands-to` takes: the nodes and edges wanted (each list left out stays as it is). */
export interface CommandsToPayload {
    readonly nodes?: readonly FlowNodeInput[] | undefined;
    readonly edges?: readonly FlowEdgeInput[] | undefined;
}

const NODE_FLAGS = [
    "draggable",
    "selectable",
    "connectable",
    "deletable",
    "hidden",
    "focusable",
] as const satisfies readonly (keyof NodeFlags)[];

const EDGE_FLAGS = [
    "selectable",
    "deletable",
    "hidden",
    "focusable",
] as const satisfies readonly (keyof EdgeFlags)[];

/** Whether `edge.reconnect` may move an edge's ends where `next` puts them. */
function reconnects(edge: FlowEdge, next: FlowEdgeInput): boolean {
    const sourceMoves =
        next.source !== edge.source || next.sourceHandle !== edge.sourceHandle;
    const targetMoves =
        next.target !== edge.target || next.targetHandle !== edge.targetHandle;
    return (
        (!sourceMoves || reconnectableEnd(edge, "source")) &&
        (!targetMoves || reconnectableEnd(edge, "target"))
    );
}

type Json = Readonly<Record<string, unknown>>;

/** Two JSON values with the same content. */
function sameJson(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (
        typeof a !== "object" ||
        typeof b !== "object" ||
        a === null ||
        b === null
    ) {
        return false;
    }
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const aKeys = Object.keys(a).filter(
        (key) => (a as Json)[key] !== undefined,
    );
    const bKeys = Object.keys(b).filter(
        (key) => (b as Json)[key] !== undefined,
    );
    return (
        aKeys.length === bKeys.length &&
        aKeys.every(
            (key) =>
                Object.hasOwn(b, key) &&
                sameJson((a as Json)[key], (b as Json)[key]),
        )
    );
}

/** The keys of `next` whose values differ from `current`'s, or undefined when a key was removed. */
function dataPatch(
    current: Json | undefined,
    next: Json | undefined,
): Record<string, unknown> | undefined {
    const before = current ?? {};
    const after = next ?? {};
    for (const key of Object.keys(before)) {
        if (before[key] !== undefined && after[key] === undefined)
            return undefined;
    }
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(after)) {
        if (value !== undefined && !sameJson(before[key], value))
            patch[key] = cloneJson(value);
    }
    return patch;
}

/** The ids `selected` says, in order. */
function selectedIds(list: readonly { id?: string; selected?: boolean }[]) {
    return list
        .filter((entity) => entity.selected === true)
        .flatMap((entity) => (entity.id === undefined ? [] : [entity.id]));
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
    if (a.length !== b.length) return false;
    const set = new Set(a);
    return b.every((id) => set.has(id));
}

/** The commands that bring `reader`'s document to `target`; `installed` names the commands it may use. */
export function commandsTo(
    reader: FlowReader,
    target: CommandsToPayload,
    installed: ReadonlySet<string>,
    defaultEdge?: Readonly<Record<string, unknown>> | undefined,
): BatchEntry[] {
    const nodesWanted = target.nodes;
    // the wanted edges as `edge.add` would store them (`defaultEdgeOptions` under what they give),
    // so an edge the defaults filled in is not synced back forever. An edge the model holds takes
    // a default only where it holds that default's value: a document edge, loaded without the
    // defaults, is not rewritten by them
    const edgesWanted =
        defaultEdge === undefined || target.edges === undefined
            ? target.edges
            : target.edges.map((edge) => {
                  const held =
                      edge.id === undefined ? undefined : reader.edge(edge.id);
                  const filled = Object.fromEntries(
                      Object.entries(defaultEdge).filter(
                          ([key, value]) =>
                              held === undefined ||
                              sameJson(
                                  (held as unknown as Record<string, unknown>)[
                                      key
                                  ],
                                  value,
                              ),
                      ),
                  );
                  return {
                      ...filled,
                      ...Object.fromEntries(
                          Object.entries(edge).filter(
                              ([, value]) => value !== undefined,
                          ),
                      ),
                  } as FlowEdgeInput;
              });
    const currentNodes = reader.nodes();
    const currentEdges = reader.edges();
    if (
        (nodesWanted === undefined || nodesWanted === currentNodes) &&
        (target.edges === undefined || target.edges === currentEdges)
    ) {
        return [];
    }
    const subflows = installed.has("node.set-parent");
    const out: BatchEntry[] = [];
    const push = (command: string, payload: unknown) =>
        out.push({ command, payload } as BatchEntry);

    // ---- nodes: which are removed, added, replaced or updated
    const wantedNodes = new Map<string, FlowNodeInput>();
    const addedNodes: FlowNodeInput[] = [];
    for (const node of nodesWanted ?? []) {
        if (node.id === undefined || !reader.node(node.id))
            addedNodes.push(node);
        if (node.id !== undefined) wantedNodes.set(node.id, node);
    }
    const removedNodes = new Set<string>();
    const replacedNodes = new Set<string>();
    if (nodesWanted !== undefined) {
        for (const node of currentNodes) {
            const next = wantedNodes.get(node.id);
            if (!next) {
                removedNodes.add(node.id);
                continue;
            }
            const resized =
                next.width !== node.width || next.height !== node.height;
            if (
                next.type !== node.type ||
                dataPatch(node.data as Json, next.data as Json) === undefined ||
                (resized &&
                    (next.width === undefined || next.height === undefined))
            ) {
                replacedNodes.add(node.id);
            }
        }
        // a node removed with its parent (`subflows()`) goes with it; a replaced parent takes its
        // children along, so they are added again too
        if (subflows) {
            let grew = true;
            while (grew) {
                grew = false;
                for (const node of currentNodes) {
                    const parent = node.parentId;
                    if (
                        parent !== undefined &&
                        replacedNodes.has(parent) &&
                        !replacedNodes.has(node.id) &&
                        !removedNodes.has(node.id)
                    ) {
                        replacedNodes.add(node.id);
                        grew = true;
                    }
                }
            }
        }
    }
    const goneNodes = new Set([...removedNodes, ...replacedNodes]);
    // whether a node goes with an ancestor of `going`
    const goesWithParent = (
        node: FlowNode,
        going: ReadonlySet<string>,
    ): boolean => {
        let parent = node.parentId;
        const seen = new Set<string>();
        while (parent !== undefined && !seen.has(parent)) {
            if (going.has(parent)) return true;
            seen.add(parent);
            parent = reader.node(parent)?.parentId;
        }
        return false;
    };

    // ---- edges
    const wantedEdges = new Map<string, FlowEdgeInput>();
    const addedEdges: FlowEdgeInput[] = [];
    for (const edge of edgesWanted ?? []) {
        if (edge.id === undefined || !reader.edge(edge.id))
            addedEdges.push(edge);
        if (edge.id !== undefined) wantedEdges.set(edge.id, edge);
    }
    const touchesGone = (edge: FlowEdge) =>
        goneNodes.has(edge.source) || goneNodes.has(edge.target);
    const removedEdges: string[] = [];
    const replacedEdges: FlowEdgeInput[] = [];
    const reconnected: FlowEdgeInput[] = [];
    const updatedEdges: [FlowEdge, FlowEdgeInput][] = [];
    for (const edge of currentEdges) {
        const next =
            edgesWanted === undefined ? edge : wantedEdges.get(edge.id);
        if (!next) {
            // an edge of a removed node goes with it
            if (!touchesGone(edge)) removedEdges.push(edge.id);
            continue;
        }
        const moved =
            next.source !== edge.source ||
            next.target !== edge.target ||
            next.sourceHandle !== edge.sourceHandle ||
            next.targetHandle !== edge.targetHandle;
        const replaced =
            (next.type ?? "bezier") !== (edge.type ?? "bezier") ||
            dataPatch(edge.data as Json, next.data as Json) === undefined ||
            (moved &&
                (!installed.has("edge.reconnect") || !reconnects(edge, next)));
        if (touchesGone(edge)) {
            // removed with its node: added again as it is wanted (an edge the app does not
            // control goes with a removed node, and comes back with a replaced one)
            if (
                edgesWanted !== undefined ||
                (!removedNodes.has(edge.source) &&
                    !removedNodes.has(edge.target))
            )
                replacedEdges.push(next);
        } else if (replaced) {
            removedEdges.push(edge.id);
            replacedEdges.push(next);
        } else {
            if (moved) reconnected.push(next);
            updatedEdges.push([edge, next]);
        }
    }

    // The props are the app's document: a flag that stops a user (`deletable`, `draggable`,
    // `connectable`) does not stop them. Each command a flag would refuse is unlocked for its own
    // step and locked again after it, in the same batch.
    const removeEdge = (edgeId: string) => {
        const edge = reader.edge(edgeId);
        const locked = edge !== undefined && !edgeFlag(edge, "deletable");
        if (locked) push("edge.set-flags", { edgeId, deletable: true });
        push("edge.remove", { edgeId });
    };
    const removeNode = (node: FlowNode) => {
        // a node goes with its children: each one that is not deletable is unlocked too
        const locked = [node, ...descendantsOf(node.id)].filter(
            (entity) => !nodeFlag(entity, "deletable"),
        );
        for (const entity of locked)
            push("node.set-flags", { nodeId: entity.id, deletable: true });
        push("node.remove", { nodeId: node.id });
    };
    const descendantsOf = (nodeId: string): FlowNode[] => {
        if (!subflows) return [];
        const children = currentNodes.filter(
            (node) => node.parentId === nodeId,
        );
        return children.flatMap((child) => [child, ...descendantsOf(child.id)]);
    };

    // 1. edges that go, then the nodes replaced (their edges and children go with them)
    for (const edgeId of removedEdges) removeEdge(edgeId);
    for (const node of currentNodes) {
        if (replacedNodes.has(node.id) && !goesWithParent(node, replacedNodes))
            removeNode(node);
    }

    // 2. the nodes added (again), each parent before its children
    const toAdd = [
        ...(nodesWanted ?? []).filter(
            (node) => node.id !== undefined && replacedNodes.has(node.id),
        ),
        ...addedNodes,
    ];
    const pending = new Set(
        toAdd.flatMap((node) => (node.id === undefined ? [] : [node.id])),
    );
    const added = new Set<FlowNodeInput>();
    let progress = true;
    while (added.size < toAdd.length && progress) {
        progress = false;
        for (const node of toAdd) {
            if (added.has(node)) continue;
            const parent = node.parentId;
            if (parent !== undefined && pending.has(parent)) continue;
            push("node.add", cloneJson(node));
            added.add(node);
            if (node.id !== undefined) pending.delete(node.id);
            progress = true;
        }
    }
    // a cycle of parents: added as they are, for the command to refuse
    for (const node of toAdd)
        if (!added.has(node)) push("node.add", cloneJson(node));

    // 3. the nodes that stay: parent, flags, position, size, data
    if (nodesWanted !== undefined) {
        for (const node of currentNodes) {
            const next = wantedNodes.get(node.id);
            if (!next || goneNodes.has(node.id)) continue;
            const nodeId = node.id;
            // `node.set-parent` keeps the node's place on screen: its wanted (relative) position
            // is moved to after it
            const reparented =
                subflows &&
                (next.parentId !== node.parentId ||
                    !sameJson(next.extent, node.extent) ||
                    (next.expandParent ?? false) !==
                        (node.expandParent ?? false));
            if (reparented) {
                push("node.set-parent", {
                    nodeId,
                    parentId: next.parentId ?? null,
                    extent: next.extent ?? null,
                    expandParent: next.expandParent ?? false,
                });
            }
            const flags: Record<string, boolean> = {};
            for (const flag of NODE_FLAGS) {
                const value = nodeFlag(next, flag);
                if (value !== nodeFlag(node, flag)) flags[flag] = value;
            }
            const hasFlags = Object.keys(flags).length > 0;
            // a node made draggable moves; one made fixed moves first
            const flagsFirst = flags.draggable !== false;
            if (hasFlags && flagsFirst)
                push("node.set-flags", { nodeId, ...flags });
            if (
                (reparented && next.parentId !== node.parentId) ||
                next.position.x !== node.position.x ||
                next.position.y !== node.position.y
            ) {
                // a node that stays fixed is unlocked for its move
                const fixed =
                    !nodeFlag(node, "draggable") && flags.draggable !== true;
                if (fixed) push("node.set-flags", { nodeId, draggable: true });
                push("node.move", {
                    nodeId,
                    position: { x: next.position.x, y: next.position.y },
                });
                if (fixed) push("node.set-flags", { nodeId, draggable: false });
            }
            if (
                next.width !== undefined &&
                next.height !== undefined &&
                (next.width !== node.width || next.height !== node.height)
            ) {
                push("node.resize", {
                    nodeId,
                    width: next.width,
                    height: next.height,
                });
            }
            if (next.zIndex !== node.zIndex)
                push("node.set-z-index", {
                    nodeId,
                    zIndex: next.zIndex ?? null,
                });
            const patch = dataPatch(node.data as Json, next.data as Json);
            if (patch && Object.keys(patch).length > 0)
                push("node.set-data", { nodeId, data: patch });
            if (hasFlags && !flagsFirst)
                push("node.set-flags", { nodeId, ...flags });
        }
    }

    // 4. the nodes removed (a child goes with its parent)
    for (const node of currentNodes) {
        if (removedNodes.has(node.id) && !goesWithParent(node, goneNodes))
            removeNode(node);
    }

    // 5. the edges added (again), moved and updated; a node that is not connectable is unlocked
    // for them
    const connecting = [...replacedEdges, ...addedEdges, ...reconnected];
    const unconnectable = [
        ...new Set(connecting.flatMap((edge) => [edge.source, edge.target])),
    ].filter((nodeId) => {
        const node = wantedNodes.get(nodeId) ?? reader.node(nodeId);
        return node !== undefined && !nodeFlag(node, "connectable");
    });
    for (const nodeId of unconnectable)
        push("node.set-flags", { nodeId, connectable: true });
    for (const edge of [...replacedEdges, ...addedEdges])
        push("edge.add", cloneJson(edge));
    for (const next of reconnected) {
        push("edge.reconnect", {
            edgeId: next.id,
            source: next.source,
            target: next.target,
            ...(next.sourceHandle === undefined
                ? {}
                : { sourceHandle: next.sourceHandle }),
            ...(next.targetHandle === undefined
                ? {}
                : { targetHandle: next.targetHandle }),
        });
    }
    for (const nodeId of unconnectable)
        push("node.set-flags", { nodeId, connectable: false });
    for (const [edge, next] of updatedEdges) {
        const edgeId = edge.id;
        const flags: Record<string, boolean | string> = {};
        for (const flag of EDGE_FLAGS) {
            const value = edgeFlag(next, flag);
            if (value !== edgeFlag(edge, flag)) flags[flag] = value;
        }
        // `reconnectable` is a flag or an end's name
        const reconnectable = next.reconnectable ?? true;
        if (reconnectable !== (edge.reconnectable ?? true))
            flags.reconnectable = reconnectable;
        if (Object.keys(flags).length > 0)
            push("edge.set-flags", { edgeId, ...flags });
        if (next.zIndex !== edge.zIndex)
            push("edge.set-z-index", { edgeId, zIndex: next.zIndex ?? null });
        const patch = dataPatch(edge.data as Json, next.data as Json);
        if (patch && Object.keys(patch).length > 0)
            push("edge.set-data", { edgeId, data: patch });
    }

    // 6. the selection (`selection()`), when it differs
    if (installed.has("selection.set")) {
        const nodeIds = selectedIds(nodesWanted ?? currentNodes);
        const edgeIds = selectedIds(edgesWanted ?? currentEdges);
        if (
            !sameIds(nodeIds, selectedIds(currentNodes)) ||
            !sameIds(edgeIds, selectedIds(currentEdges))
        ) {
            push("selection.set", { nodeIds, edgeIds, mode: "replace" });
        }
    }
    return out;
}
