// The rules several commands share: finding what a payload names (`not_found` at its path), the
// rules of a connection (`edge.add`, `edge.reconnect`: both nodes exist and are connectable, no
// second edge between the same handles), and a removal (a node takes its edges with it, and with
// sub-flows its children). Written from the behaviour the flow needs, nothing ported.
import { nodeFlag } from "../document/flags";
import type { FlowEdge, FlowNode } from "../document/types";
import type { ComposedFeatures } from "../features/registry";
import type { Draft } from "../state/draft";
import { type Failure, fail } from "./define";
import type { ConnectionPayload, RemovedResult } from "./types";

/** Whether a reducer's lookup failed. */
export function isFailure(value: object): value is Failure {
    return (value as { ok?: unknown }).ok === false;
}

/** The node an id names, or `not_found` at `path`. */
export function findNode(
    draft: Draft,
    id: string,
    path: string,
): FlowNode | Failure {
    return draft.node(id) ?? fail("not_found", `no node "${id}"`, path);
}

/** The edge an id names, or `not_found` at `path`. */
export function findEdge(
    draft: Draft,
    id: string,
    path: string,
): FlowEdge | Failure {
    return draft.edge(id) ?? fail("not_found", `no edge "${id}"`, path);
}

/** Whether two edges join the same handles of the same nodes, in the same direction. */
function sameEnds(edge: FlowEdge, connection: ConnectionPayload): boolean {
    return (
        edge.source === connection.source &&
        edge.target === connection.target &&
        edge.sourceHandle === connection.sourceHandle &&
        edge.targetHandle === connection.targetHandle
    );
}

/**
 * Why an edge may not join these ends, or `undefined`: a missing node (`not_found`), a node that is
 * not connectable, or an edge already there between the same handles (`refused`). `ignoreEdgeId`
 * is the edge being reconnected.
 */
export function connectionProblem(
    draft: Draft,
    connection: ConnectionPayload,
    ignoreEdgeId?: string,
): Failure | undefined {
    for (const end of ["source", "target"] as const) {
        const node = findNode(draft, connection[end], `/${end}`);
        if (isFailure(node)) {
            return node;
        }
        if (!nodeFlag(node, "connectable")) {
            return fail(
                "refused",
                `node "${node.id}" is not connectable`,
                `/${end}`,
            );
        }
    }
    const twin = draft
        .edges()
        .find((edge) => edge.id !== ignoreEdgeId && sameEnds(edge, connection));
    return twin
        ? fail(
              "refused",
              `edge "${twin.id}" already joins these handles`,
              "/source",
          )
        : undefined;
}

/** The nodes that go when `nodeId` goes: itself and, through the features, what goes with it. */
export function removalOf(
    draft: Draft,
    features: ComposedFeatures,
    nodeId: string,
): Set<string> {
    const ids = new Set([nodeId]);
    features.removing(draft, ids);
    return ids;
}

/** Removes nodes, their edges and the edges given, in one step: what it removed, in drawing order. */
export function removeAll(
    draft: Draft,
    nodeIds: ReadonlySet<string>,
    edgeIds: ReadonlySet<string> = new Set(),
): RemovedResult {
    const removedNodeIds = draft
        .nodes()
        .filter((node) => nodeIds.has(node.id))
        .map((node) => node.id);
    const edges = draft
        .edges()
        .filter(
            (edge) =>
                edgeIds.has(edge.id) ||
                nodeIds.has(edge.source) ||
                nodeIds.has(edge.target),
        )
        .map((edge) => edge.id);
    draft.removeNodes(nodeIds);
    draft.removeEdges(new Set(edges));
    return { removedNodeIds, removedEdgeIds: edges };
}
