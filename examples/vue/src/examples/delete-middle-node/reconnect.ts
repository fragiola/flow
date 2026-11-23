// Which edges keep a flow connected when nodes are deleted: each incomer of a deleted node is
// joined to each of its outgoers. Framework-free: it reads plain edges and returns the edges to
// add, so the example runs them in the same `batch` as the removal.
//
// Several nodes go one after the other, as if deleted in turn: deleting B and C of A → B → C → D
// joins A to D (A → C only lives between the two steps, so it is never added). A pair already
// joined, in that direction, is skipped, and so is a pair that would join a node to itself.

/** What the planner reads of an edge: the model's edges fit. */
export interface EdgeLike {
    readonly id: string;
    readonly source: string;
    readonly target: string;
    readonly sourceHandle?: string | undefined;
    readonly targetHandle?: string | undefined;
}

/** An edge to add: `edge.add`'s payload. */
export interface PlannedEdge {
    readonly id: string;
    readonly source: string;
    readonly target: string;
    readonly sourceHandle?: string;
    readonly targetHandle?: string;
}

/** Options of {@link reconnectionPlan}. */
export interface PlanOptions {
    /** edges deleted together with the nodes: they join nothing (default none) */
    readonly removedEdgeIds?: readonly string[];
    /** whether an id is taken already, beyond `edges` (default: never) */
    readonly isTaken?: (id: string) => boolean;
}

interface Working extends EdgeLike {
    /** planned here, not in the document */
    readonly planned: boolean;
}

/** Whether an edge already runs from `source` to `target`, whatever its handles. */
export function joined(
    edges: readonly EdgeLike[],
    source: string,
    target: string,
): boolean {
    return edges.some(
        (edge) => edge.source === source && edge.target === target,
    );
}

/** `<source>-<target>`, or with `-2`, `-3`… when that is taken. */
export function edgeIdFor(
    source: string,
    target: string,
    taken: (id: string) => boolean,
): string {
    const base = `${source}-${target}`;
    if (!taken(base)) return base;
    let n = 2;
    while (taken(`${base}-${n}`)) n += 1;
    return `${base}-${n}`;
}

/**
 * The edges to add so that deleting `nodeIds` (in order) keeps the flow connected through them:
 * every incomer × outgoer pair, once, never a self loop, never a pair already joined. `edges` must
 * hold every edge that touches the deleted nodes or their neighbours (`connected-edges-by`).
 */
export function reconnectionPlan(
    edges: readonly EdgeLike[],
    nodeIds: readonly string[],
    options: PlanOptions = {},
): PlannedEdge[] {
    const removed = new Set(options.removedEdgeIds ?? []);
    const isTaken = options.isTaken ?? (() => false);
    const ids = new Set(edges.map((edge) => edge.id));
    let working: Working[] = edges
        .filter((edge) => !removed.has(edge.id))
        .map((edge) => ({ ...edge, planned: false }));
    for (const nodeId of new Set(nodeIds)) {
        const incoming = working.filter(
            (edge) => edge.target === nodeId && edge.source !== nodeId,
        );
        const outgoing = working.filter(
            (edge) => edge.source === nodeId && edge.target !== nodeId,
        );
        working = working.filter(
            (edge) => edge.source !== nodeId && edge.target !== nodeId,
        );
        for (const into of incoming) {
            for (const out of outgoing) {
                const source = into.source;
                const target = out.target;
                if (source === target || joined(working, source, target))
                    continue;
                const id = edgeIdFor(
                    source,
                    target,
                    (candidate) => ids.has(candidate) || isTaken(candidate),
                );
                ids.add(id);
                working.push({
                    id,
                    source,
                    target,
                    ...(into.sourceHandle === undefined
                        ? {}
                        : { sourceHandle: into.sourceHandle }),
                    ...(out.targetHandle === undefined
                        ? {}
                        : { targetHandle: out.targetHandle }),
                    planned: true,
                });
            }
        }
    }
    return working
        .filter((edge) => edge.planned)
        .map(({ planned: _, ...edge }) => edge);
}
