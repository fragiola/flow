// The core's node commands (D6). Flags are enforced here, so no caller can bypass them: a node
// that is not draggable does not move, one that is not deletable is not removed. Removing a node
// removes its edges in the same step (and, with `subflows()`, its children).
import {
    nodeFlagProperties,
    nodeSchema,
    xySchema,
    zIndexSchema,
} from "../document/document-schema";
import { nodeFlag } from "../document/flags";
import type { FlowNode } from "../document/types";
import { cloneJson } from "../state/clone-json";
import { defineCommand, fail, invalid, ok } from "./define";
import { findNode, isFailure, removalOf, removeAll } from "./rules";

const nodeId = {
    type: "string",
    minLength: 1,
    description: "the node's id",
} as const;

const removedSchema = {
    type: "object",
    properties: {
        removedNodeIds: {
            type: "array",
            items: { type: "string" },
            description: "the nodes removed, in drawing order",
        },
        removedEdgeIds: {
            type: "array",
            items: { type: "string" },
            description:
                "the edges removed: those that touched a removed node, and those removed themselves",
        },
    },
    required: ["removedNodeIds", "removedEdgeIds"],
    additionalProperties: false,
} as const;

const nodeIdResult = {
    type: "object",
    properties: { nodeId },
    required: ["nodeId"],
    additionalProperties: false,
} as const;

export const nodeAdd = defineCommand({
    name: "node.add",
    description:
        "Adds a node at the end of the drawing order: its type, position and data, optionally its id (generated when missing), size and flags. Refused when the id is taken.",
    payloadSchema: nodeSchema,
    resultSchema: nodeIdResult,
    transient: false,
    reduce: (payload, { draft, features }) => {
        const missing = invalid(
            features.missingFields("nodeFields", payload, ""),
        );
        if (missing) {
            return missing;
        }
        if (payload.id !== undefined && draft.node(payload.id)) {
            return fail("refused", `a node "${payload.id}" exists`, "/id");
        }
        const { id = draft.nextNodeId(), ...fields } = cloneJson(payload);
        const node = { id, ...fields } as FlowNode;
        const refused = features.checkNode(draft, node, "");
        if (refused) {
            return refused;
        }
        draft.putNode({
            ...node,
            position: features.constrainPosition(draft, node, node.position),
        });
        features.nodeChanged(draft, id);
        return ok({ nodeId: id });
    },
});

export const nodeRemove = defineCommand({
    name: "node.remove",
    description:
        "Removes a node and every edge that starts or ends at it, in one step; with sub-flows, its children go too. Refused when the node (or a child) is not deletable.",
    payloadSchema: {
        type: "object",
        properties: { nodeId },
        required: ["nodeId"],
        additionalProperties: false,
    },
    resultSchema: removedSchema,
    transient: false,
    reduce: ({ nodeId }, { draft, features }) => {
        const node = findNode(draft, nodeId, "/nodeId");
        if (isFailure(node)) {
            return node;
        }
        const ids = removalOf(draft, features, nodeId);
        for (const id of ids) {
            const removed = draft.node(id);
            if (removed && !nodeFlag(removed, "deletable")) {
                return fail(
                    "refused",
                    id === nodeId
                        ? `node "${id}" is not deletable`
                        : `node "${nodeId}" holds node "${id}", which is not deletable`,
                    "/nodeId",
                );
            }
        }
        return ok(removeAll(draft, ids));
    },
});

export const nodeMove = defineCommand({
    name: "node.move",
    description:
        "Moves a node to a position (relative to its parent with sub-flows), kept to its extent. Refused when the node is not draggable. A drag runs it as transient steps, then once more for the drop.",
    payloadSchema: {
        type: "object",
        properties: {
            nodeId,
            position: {
                ...xySchema,
                description:
                    "its new top-left corner, in flow coordinates (relative to its parent with sub-flows)",
            },
        },
        required: ["nodeId", "position"],
        additionalProperties: false,
    },
    resultSchema: {
        type: "object",
        properties: {
            nodeId,
            position: {
                ...xySchema,
                description: "the position it got, kept to its extent",
            },
        },
        required: ["nodeId", "position"],
        additionalProperties: false,
    },
    transient: true,
    reduce: ({ nodeId, position }, { draft, features }) => {
        const node = findNode(draft, nodeId, "/nodeId");
        if (isFailure(node)) {
            return node;
        }
        if (!nodeFlag(node, "draggable")) {
            return fail(
                "refused",
                `node "${nodeId}" is not draggable`,
                "/nodeId",
            );
        }
        const kept = features.constrainPosition(draft, node, {
            x: position.x,
            y: position.y,
        });
        draft.putNode({ ...node, position: kept });
        features.nodeChanged(draft, nodeId);
        // where it ended: a parent that grew to hold it may have shifted it
        return ok({ nodeId, position: draft.node(nodeId)?.position ?? kept });
    },
});

export const nodeResize = defineCommand({
    name: "node.resize",
    description:
        "Sets a node's width and height, and optionally its position (a resize from a top or left edge moves it), kept to its extent. A resize gesture runs it as transient steps, then once more at the end.",
    payloadSchema: {
        type: "object",
        properties: {
            nodeId,
            width: { type: "number", minimum: 0, description: "its new width" },
            height: {
                type: "number",
                minimum: 0,
                description: "its new height",
            },
            position: {
                ...xySchema,
                description: "its new top-left corner; none: it stays",
            },
        },
        required: ["nodeId", "width", "height"],
        additionalProperties: false,
    },
    resultSchema: {
        type: "object",
        properties: {
            nodeId,
            width: { type: "number", description: "its width" },
            height: { type: "number", description: "its height" },
            position: {
                ...xySchema,
                description: "the position it got, kept to its extent",
            },
        },
        required: ["nodeId", "width", "height", "position"],
        additionalProperties: false,
    },
    transient: true,
    reduce: ({ nodeId, width, height, position }, { draft, features }) => {
        const node = findNode(draft, nodeId, "/nodeId");
        if (isFailure(node)) {
            return node;
        }
        const resized = { ...node, width, height };
        const kept = features.constrainPosition(
            draft,
            resized,
            position ? { x: position.x, y: position.y } : node.position,
        );
        draft.putNode({ ...resized, position: kept });
        features.nodeChanged(draft, nodeId);
        return ok({
            nodeId,
            width,
            height,
            position: draft.node(nodeId)?.position ?? kept,
        });
    },
});

export const nodeSetData = defineCommand({
    name: "node.set-data",
    description:
        "Merges a shallow patch into a node's data: each top-level key given replaces the node's own.",
    payloadSchema: {
        type: "object",
        properties: {
            nodeId,
            data: {
                type: "object",
                description: "the keys to set in the node's data",
            },
        },
        required: ["nodeId", "data"],
        additionalProperties: false,
    },
    resultSchema: nodeIdResult,
    transient: false,
    reduce: ({ nodeId, data }, { draft }) => {
        const node = findNode(draft, nodeId, "/nodeId");
        if (isFailure(node)) {
            return node;
        }
        draft.putNode({ ...node, data: { ...node.data, ...cloneJson(data) } });
        return ok({ nodeId });
    },
});

export const nodeSetFlags = defineCommand({
    name: "node.set-flags",
    description:
        "Sets some of a node's flags (draggable, selectable, connectable, deletable, hidden); the others stay. A node made unselectable is deselected.",
    payloadSchema: {
        type: "object",
        properties: { nodeId, ...nodeFlagProperties },
        required: ["nodeId"],
        additionalProperties: false,
    },
    resultSchema: nodeIdResult,
    transient: false,
    reduce: ({ nodeId, ...flags }, { draft, features }) => {
        const node = findNode(draft, nodeId, "/nodeId");
        if (isFailure(node)) {
            return node;
        }
        draft.putNode({ ...node, ...flags });
        features.flagsChanged(draft, "node", nodeId);
        return ok({ nodeId });
    },
});

export const nodeSetZIndex = defineCommand({
    name: "node.set-z-index",
    description:
        "Sets a node's `zIndex`, its place in the nodes' stacking order (null: the default, 0), in place: its edges and measurements stay.",
    payloadSchema: {
        type: "object",
        properties: {
            nodeId,
            zIndex: {
                anyOf: [zIndexSchema, { type: "null" }],
                description:
                    "its place in its layer's stacking order (an integer); null: back to the default, 0",
            },
        },
        required: ["nodeId", "zIndex"],
        additionalProperties: false,
    },
    resultSchema: nodeIdResult,
    transient: false,
    reduce: ({ nodeId, zIndex }, { draft }) => {
        const node = findNode(draft, nodeId, "/nodeId");
        if (isFailure(node)) {
            return node;
        }
        const { zIndex: _was, ...rest } = node;
        draft.putNode(
            (zIndex === null ? rest : { ...rest, zIndex }) as typeof node,
        );
        return ok({ nodeId });
    },
});
