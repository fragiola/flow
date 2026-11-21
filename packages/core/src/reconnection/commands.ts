// `edge.reconnect` (D6, the reconnection feature): moves one or both ends of an edge to other
// nodes or handles, keeping its id, type and data. The same rules as `edge.add` (both nodes exist
// and are connectable, no second edge between the same handles), and the edge's own
// `reconnectable` flag; a middleware's veto refuses it (D7: `model.can("edge.reconnect", …)` is a
// reconnection's validity).
import { defineCommand, fail, ok } from "../commands/define";
import { connectionProblem, findEdge, isFailure } from "../commands/rules";
import { edgeSchema } from "../document/document-schema";
import { edgeFlag } from "../document/flags";

const { source, target, sourceHandle, targetHandle } = edgeSchema.properties;
const edgeId = {
    type: "string",
    minLength: 1,
    description: "the edge's id",
} as const;

export const edgeReconnect = defineCommand({
    name: "edge.reconnect",
    description:
        "Moves an edge's ends: its new source and target nodes and, optionally, handles (a handle left out is none). Its id, type and data stay. Refused when the edge is not reconnectable, a node is not connectable, or another edge already joins the same handles.",
    payloadSchema: {
        type: "object",
        properties: { edgeId, source, target, sourceHandle, targetHandle },
        required: ["edgeId", "source", "target"],
        additionalProperties: false,
    },
    resultSchema: {
        type: "object",
        properties: { edgeId },
        required: ["edgeId"],
        additionalProperties: false,
    },
    transient: false,
    reduce: ({ edgeId, ...ends }, { draft }) => {
        const edge = findEdge(draft, edgeId, "/edgeId");
        if (isFailure(edge)) {
            return edge;
        }
        if (!edgeFlag(edge, "reconnectable")) {
            return fail(
                "refused",
                `edge "${edgeId}" is not reconnectable`,
                "/edgeId",
            );
        }
        const problem = connectionProblem(draft, ends, edgeId);
        if (problem) {
            return problem;
        }
        const {
            sourceHandle: _sourceHandle,
            targetHandle: _targetHandle,
            ...kept
        } = edge;
        draft.putEdge({ ...kept, ...ends });
        return ok({ edgeId });
    },
});
