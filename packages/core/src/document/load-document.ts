// Loads a flow document (D3): checks it against its JSON Schema and the rules a schema cannot say
// (ids unique, edges between existing nodes, one edge per pair of handles, the installed features'
// own rules), refuses a field of a feature that is not installed, generates the missing ids and
// freezes the result. Every problem is reported, each with its JSON path.
import type { ComposedFeatures } from "../features/registry";
import type { ValidationIssue } from "../schema/types";
import { isObject, validate } from "../schema/validator";
import { cloneJson } from "../state/clone-json";
import { deepFreeze } from "../state/deep-freeze";
import { type IndexedDocument, indexOf, readerOf } from "../state/draft";
import type { IdSource } from "./create-id";
import { flowDocumentSchema } from "./document-schema";
import type { FlowDocument, FlowEdge, FlowNode } from "./types";

/** A loaded document, or every problem found in it. */
export type Loaded =
    | { readonly ok: true; readonly indexed: IndexedDocument }
    | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

/** The entries of an array field of `json`, when it is one. */
function entries(json: unknown, key: string): unknown[] {
    const list = isObject(json) ? json[key] : undefined;
    return Array.isArray(list) ? list : [];
}

/** A string field of an entry of unknown shape. */
function stringField(entry: unknown, key: string): string | undefined {
    const value = isObject(entry) ? entry[key] : undefined;
    return typeof value === "string" ? value : undefined;
}

/** Ids given twice in a list, as issues at the later one's `/id`. */
function duplicateIds(
    list: readonly unknown[],
    path: string,
    kind: string,
): ValidationIssue[] {
    const first = new Map<string, number>();
    const issues: ValidationIssue[] = [];
    list.forEach((entity, i) => {
        const id = stringField(entity, "id");
        if (id === undefined) {
            return;
        }
        const seen = first.get(id);
        if (seen === undefined) {
            first.set(id, i);
        } else {
            issues.push({
                path: `${path}/${i}/id`,
                message: `duplicates the id of ${kind} ${path}/${seen}`,
            });
        }
    });
    return issues;
}

/** Edges whose ends are not nodes, and edges joining the same handles as an earlier one. */
function edgeIssues(
    edges: readonly unknown[],
    nodeIds: ReadonlySet<string>,
    path: string,
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const pairs = new Map<string, number>();
    edges.forEach((edge, i) => {
        const source = stringField(edge, "source");
        const target = stringField(edge, "target");
        for (const [end, id] of [
            ["source", source],
            ["target", target],
        ] as const) {
            if (id !== undefined && !nodeIds.has(id)) {
                issues.push({
                    path: `${path}/${i}/${end}`,
                    message: `no node "${id}"`,
                });
            }
        }
        if (source === undefined || target === undefined) {
            return;
        }
        const pair = JSON.stringify([
            source,
            stringField(edge, "sourceHandle") ?? null,
            target,
            stringField(edge, "targetHandle") ?? null,
        ]);
        const twin = pairs.get(pair);
        if (twin === undefined) {
            pairs.set(pair, i);
        } else {
            issues.push({
                path: `${path}/${i}`,
                message: `joins the same handles as edge ${path}/${twin}`,
            });
        }
    });
    return issues;
}

/**
 * Loads `json` as a flow document with the installed `features`; `prefix` places every path
 * (a document inside a payload). Every check runs on what it can read, so one load reports every
 * problem: the schema's, the ids', the edges' ends and the features' rules.
 */
export function loadDocument(
    json: unknown,
    ids: IdSource,
    features: ComposedFeatures,
    freeze: boolean,
    prefix = "",
): Loaded {
    const nodeEntries = entries(json, "nodes");
    const edgeEntries = entries(json, "edges");
    const shape = validate(flowDocumentSchema, json, prefix);
    const issues: ValidationIssue[] = [
        ...shape,
        ...nodeEntries.flatMap((node, i) =>
            isObject(node)
                ? features.missingFields(
                      "nodeFields",
                      node,
                      `${prefix}/nodes/${i}`,
                  )
                : [],
        ),
        ...edgeEntries.flatMap((edge, i) =>
            isObject(edge)
                ? features.missingFields(
                      "edgeFields",
                      edge,
                      `${prefix}/edges/${i}`,
                  )
                : [],
        ),
        ...duplicateIds(nodeEntries, `${prefix}/nodes`, "node"),
        ...duplicateIds(edgeEntries, `${prefix}/edges`, "edge"),
    ];

    // ids: the given ones, then one for each entry without
    const nodeIds = new Set(
        nodeEntries.flatMap((node) => stringField(node, "id") ?? []),
    );
    const edgeIds = new Set(
        edgeEntries.flatMap((edge) => stringField(edge, "id") ?? []),
    );
    const withId = <E>(
        entry: unknown,
        kind: "node" | "edge",
        taken: Set<string>,
    ): E => {
        if (!isObject(entry)) {
            return entry as E;
        }
        const { id, ...fields } = cloneJson(entry);
        const given = typeof id === "string" ? id : undefined;
        const entryId =
            given ?? ids.next(kind, (candidate) => taken.has(candidate));
        taken.add(entryId);
        return { id: entryId, ...fields } as E;
    };
    const nodes = nodeEntries.map((node) =>
        withId<FlowNode>(node, "node", nodeIds),
    );
    const edges = edgeEntries.map((edge) =>
        withId<FlowEdge>(edge, "edge", edgeIds),
    );
    issues.push(...edgeIssues(edges, nodeIds, `${prefix}/edges`));

    const flow: FlowDocument = { version: 1, nodes, edges };
    const indexed: IndexedDocument = {
        document: flow,
        nodeIndex: indexOf(nodes.filter(isObject)),
        edgeIndex: indexOf(edges.filter(isObject)),
    };
    // a feature's rules read nodes and edges: only when every entry is one
    if (nodes.every(isObject) && edges.every(isObject)) {
        issues.push(
            ...features.documentIssues(readerOf(indexed)).map((issue) => ({
                path: `${prefix}${issue.path}`,
                message: issue.message,
            })),
        );
    }
    if (issues.length > 0) {
        return { ok: false, issues };
    }
    if (freeze) {
        deepFreeze(flow);
    }
    return { ok: true, indexed };
}
