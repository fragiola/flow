// The selection's commands (D6). Being selected is a field of the node or edge itself
// (`selected: true`, absent when not), so the document stays the single source of truth and
// `get("flow-json")` writes the selection back. A node or edge that is not selectable is refused;
// `selection.remove` (the Delete key's) removes what is selected and deletable, with their edges and
// (with sub-flows) their children, skipping what is not deletable.
import { defineCommand, fail, ok } from "../commands/define";
import { removalOf, removeAll } from "../commands/rules";
import type { SelectionResult } from "../commands/types";
import { edgeFlag, nodeFlag } from "../document/flags";
import type { FlowEdge, FlowNode } from "../document/types";
import type { Draft } from "../state/draft";

const ids = (description: string) =>
    ({
        type: "array",
        items: { type: "string", minLength: 1 },
        description,
    }) as const;

const selectionResult = {
    type: "object",
    properties: {
        nodeIds: ids("the nodes, in drawing order"),
        edgeIds: ids("the edges, in drawing order"),
    },
    required: ["nodeIds", "edgeIds"],
    additionalProperties: false,
} as const;

/** An entity with its `selected` field set (removed when false). */
function withSelected<E extends FlowNode | FlowEdge>(
    entity: E,
    selected: boolean,
): E {
    if ((entity.selected === true) === selected) {
        return entity;
    }
    const { selected: _was, ...rest } = entity;
    return (selected ? { ...rest, selected: true } : rest) as E;
}

/** The selected node and edge ids of a draft, in drawing order. */
export function selectedIds(draft: Draft): SelectionResult {
    return {
        nodeIds: draft
            .nodes()
            .filter((node) => node.selected === true)
            .map((node) => node.id),
        edgeIds: draft
            .edges()
            .filter((edge) => edge.selected === true)
            .map((edge) => edge.id),
    };
}

/** Sets the selection of every node and edge by `selected`, writing only those that change. */
function applySelection(
    draft: Draft,
    nodeSelected: (node: FlowNode) => boolean,
    edgeSelected: (edge: FlowEdge) => boolean,
): void {
    for (const node of draft.nodes()) {
        const next = withSelected(node, nodeSelected(node));
        if (next !== node) draft.putNode(next);
    }
    for (const edge of draft.edges()) {
        const next = withSelected(edge, edgeSelected(edge));
        if (next !== edge) draft.putEdge(next);
    }
}

export const selectionSet = defineCommand({
    name: "selection.set",
    description:
        'Selects nodes and edges: `"replace"` (the default) makes them the whole selection, `"add"` adds them, `"toggle"` flips each one. Refused when one is not selectable.',
    payloadSchema: {
        type: "object",
        properties: {
            nodeIds: ids("the nodes; none: no node"),
            edgeIds: ids("the edges; none: no edge"),
            mode: {
                enum: ["replace", "add", "toggle"],
                description:
                    'how they combine with the selection: "replace" (default), "add" or "toggle"',
            },
        },
        additionalProperties: false,
    },
    resultSchema: {
        ...selectionResult,
        description: "the selection after the command",
    },
    transient: true,
    reduce: ({ nodeIds = [], edgeIds = [], mode = "replace" }, { draft }) => {
        for (const [i, id] of nodeIds.entries()) {
            const node = draft.node(id);
            if (!node) {
                return fail("not_found", `no node "${id}"`, `/nodeIds/${i}`);
            }
            if (!nodeFlag(node, "selectable")) {
                return fail(
                    "refused",
                    `node "${id}" is not selectable`,
                    `/nodeIds/${i}`,
                );
            }
        }
        for (const [i, id] of edgeIds.entries()) {
            const edge = draft.edge(id);
            if (!edge) {
                return fail("not_found", `no edge "${id}"`, `/edgeIds/${i}`);
            }
            if (!edgeFlag(edge, "selectable")) {
                return fail(
                    "refused",
                    `edge "${id}" is not selectable`,
                    `/edgeIds/${i}`,
                );
            }
        }
        const nodes = new Set(nodeIds);
        const edges = new Set(edgeIds);
        const rule = (given: Set<string>) => (entity: FlowNode | FlowEdge) => {
            const was = entity.selected === true;
            if (mode === "replace") return given.has(entity.id);
            if (mode === "add") return was || given.has(entity.id);
            return given.has(entity.id) ? !was : was;
        };
        applySelection(draft, rule(nodes), rule(edges));
        return ok(selectedIds(draft));
    },
});

export const selectionClear = defineCommand({
    name: "selection.clear",
    description: "Deselects every node and edge.",
    payloadSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
    },
    resultSchema: {
        ...selectionResult,
        description: "what was selected before",
    },
    transient: false,
    reduce: (_payload, { draft }) => {
        const before = selectedIds(draft);
        applySelection(
            draft,
            () => false,
            () => false,
        );
        return ok(before);
    },
});

export const selectionRemove = defineCommand({
    name: "selection.remove",
    description:
        "Removes the selected nodes and edges that are deletable, in one step: a node takes its edges with it and, with sub-flows, its children (a node holding one that is not deletable stays).",
    payloadSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
    },
    resultSchema: {
        type: "object",
        properties: {
            removedNodeIds: ids("the nodes removed, in drawing order"),
            removedEdgeIds: ids(
                "the edges removed: the selected ones and those that touched a removed node",
            ),
        },
        required: ["removedNodeIds", "removedEdgeIds"],
        additionalProperties: false,
    },
    transient: false,
    reduce: (_payload, { draft, features }) => {
        const nodeIds = new Set<string>();
        for (const node of draft.nodes()) {
            if (node.selected !== true || !nodeFlag(node, "deletable"))
                continue;
            const goes = removalOf(draft, features, node.id);
            const kept = [...goes].some((id) => {
                const held = draft.node(id);
                return held !== undefined && !nodeFlag(held, "deletable");
            });
            if (!kept) for (const id of goes) nodeIds.add(id);
        }
        const edgeIds = new Set(
            draft
                .edges()
                .filter(
                    (edge) =>
                        edge.selected === true && edgeFlag(edge, "deletable"),
                )
                .map((edge) => edge.id),
        );
        return ok(removeAll(draft, nodeIds, edgeIds));
    },
});
