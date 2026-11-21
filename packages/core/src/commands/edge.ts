// The core's edge commands (D6). An edge joins two existing, connectable nodes, and no second edge
// joins the same handles in the same direction; a middleware decides the app's own rules (D7:
// `model.can("edge.add", …)` is a connection's validity).
import { edgeFlagProperties, edgeSchema } from "../document/document-schema";
import { edgeFlag } from "../document/flags";
import type { FlowEdge } from "../document/types";
import { cloneJson } from "../state/clone-json";
import { defineCommand, fail, invalid, ok } from "./define";
import { connectionProblem, findEdge, isFailure } from "./rules";

const edgeId = {
    type: "string",
    minLength: 1,
    description: "the edge's id",
} as const;

const edgeIdResult = {
    type: "object",
    properties: { edgeId },
    required: ["edgeId"],
    additionalProperties: false,
} as const;

export const edgeAdd = defineCommand({
    name: "edge.add",
    description:
        "Adds an edge from a source node to a target node, optionally between two of their handles, with its type, data and flags (its id generated when missing). Refused when a node is not connectable, when an edge already joins the same handles, or when the id is taken.",
    payloadSchema: edgeSchema,
    resultSchema: edgeIdResult,
    transient: false,
    reduce: (payload, { draft, features }) => {
        const missing = invalid(
            features.missingFields("edgeFields", payload, ""),
        );
        if (missing) {
            return missing;
        }
        if (payload.id !== undefined && draft.edge(payload.id)) {
            return fail("refused", `an edge "${payload.id}" exists`, "/id");
        }
        const problem = connectionProblem(draft, payload);
        if (problem) {
            return problem;
        }
        const { id = draft.nextEdgeId(), ...fields } = cloneJson(payload);
        const edge = { id, ...fields } as FlowEdge;
        const refused = features.checkEdge(draft, edge, "");
        if (refused) {
            return refused;
        }
        draft.putEdge(edge);
        return ok({ edgeId: id });
    },
});

export const edgeRemove = defineCommand({
    name: "edge.remove",
    description: "Removes an edge. Refused when it is not deletable.",
    payloadSchema: {
        type: "object",
        properties: { edgeId },
        required: ["edgeId"],
        additionalProperties: false,
    },
    resultSchema: edgeIdResult,
    transient: false,
    reduce: ({ edgeId }, { draft }) => {
        const edge = findEdge(draft, edgeId, "/edgeId");
        if (isFailure(edge)) {
            return edge;
        }
        if (!edgeFlag(edge, "deletable")) {
            return fail(
                "refused",
                `edge "${edgeId}" is not deletable`,
                "/edgeId",
            );
        }
        draft.removeEdges(new Set([edgeId]));
        return ok({ edgeId });
    },
});

export const edgeSetData = defineCommand({
    name: "edge.set-data",
    description:
        "Merges a shallow patch into an edge's data: each top-level key given replaces the edge's own.",
    payloadSchema: {
        type: "object",
        properties: {
            edgeId,
            data: {
                type: "object",
                description: "the keys to set in the edge's data",
            },
        },
        required: ["edgeId", "data"],
        additionalProperties: false,
    },
    resultSchema: edgeIdResult,
    transient: false,
    reduce: ({ edgeId, data }, { draft }) => {
        const edge = findEdge(draft, edgeId, "/edgeId");
        if (isFailure(edge)) {
            return edge;
        }
        draft.putEdge({ ...edge, data: { ...edge.data, ...cloneJson(data) } });
        return ok({ edgeId });
    },
});

export const edgeSetFlags = defineCommand({
    name: "edge.set-flags",
    description:
        "Sets some of an edge's flags (selectable, deletable, hidden, reconnectable); the others stay. An edge made unselectable is deselected.",
    payloadSchema: {
        type: "object",
        properties: { edgeId, ...edgeFlagProperties },
        required: ["edgeId"],
        additionalProperties: false,
    },
    resultSchema: edgeIdResult,
    transient: false,
    reduce: ({ edgeId, ...flags }, { draft, features }) => {
        const edge = findEdge(draft, edgeId, "/edgeId");
        if (isFailure(edge)) {
            return edge;
        }
        draft.putEdge({ ...edge, ...flags });
        features.flagsChanged(draft, "edge", edgeId);
        return ok({ edgeId });
    },
});
