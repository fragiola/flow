// `node.set-parent` (D6, the subflows feature): puts a node into another, or back on the flow,
// keeping where it is on screen (its position becomes relative to its new parent), and sets how it
// stays in its parent (`extent`, `expandParent`). Refused when the parent would be the node itself
// or one of its own descendants.
import { defineCommand, fail, ok } from "../commands/define";
import { findNode, isFailure } from "../commands/rules";
import { xySchema } from "../document/document-schema";
import type { FlowNode } from "../document/types";
import { absolutePositionOf, descendantsOf } from "./hierarchy";

const nodeId = {
    type: "string",
    minLength: 1,
    description: "the node's id",
} as const;

export const nodeSetParent = defineCommand({
    name: "node.set-parent",
    description:
        "Puts a node into a parent node (`parentId`), or back on the flow (`null`), keeping its place on screen: its position becomes relative to the new parent. `extent` and `expandParent` set how it stays in its parent. Refused when the parent is the node itself or one of its descendants.",
    payloadSchema: {
        type: "object",
        properties: {
            nodeId,
            parentId: {
                anyOf: [{ type: "string", minLength: 1 }, { type: "null" }],
                description: "the new parent's id, or null for none",
            },
            extent: {
                anyOf: [{ const: "parent" }, { type: "null" }],
                description:
                    '"parent": it stays inside its parent; null: it may leave it; none: as it was',
            },
            expandParent: {
                type: "boolean",
                description:
                    "its parent grows to keep it inside; none: as it was",
            },
        },
        required: ["nodeId", "parentId"],
        additionalProperties: false,
    },
    resultSchema: {
        type: "object",
        properties: {
            nodeId,
            position: {
                ...xySchema,
                description: "its position, relative to its new parent",
            },
        },
        required: ["nodeId", "position"],
        additionalProperties: false,
    },
    transient: false,
    reduce: (
        { nodeId, parentId, extent, expandParent },
        { draft, features },
    ) => {
        const node = findNode(draft, nodeId, "/nodeId");
        if (isFailure(node)) {
            return node;
        }
        let parent: FlowNode | undefined;
        if (parentId !== null) {
            const found = findNode(draft, parentId, "/parentId");
            if (isFailure(found)) {
                return found;
            }
            if (
                parentId === nodeId ||
                descendantsOf(draft, nodeId).includes(parentId)
            ) {
                return fail(
                    "refused",
                    `node "${parentId}" cannot be the parent of node "${nodeId}": it is the node or one of its descendants`,
                    "/parentId",
                );
            }
            parent = found;
        }
        const absolute = absolutePositionOf(draft, node);
        const origin = parent
            ? absolutePositionOf(draft, parent)
            : { x: 0, y: 0 };
        const {
            parentId: _parent,
            extent: ownExtent,
            expandParent: ownExpand,
            ...rest
        } = node;
        const keptExtent =
            extent === undefined ? ownExtent : (extent ?? undefined);
        const keptExpand = expandParent ?? ownExpand;
        const moved = {
            ...rest,
            position: { x: absolute.x - origin.x, y: absolute.y - origin.y },
            ...(parent ? { parentId: parent.id } : {}),
            ...(parent && keptExtent !== undefined
                ? { extent: keptExtent }
                : {}),
            ...(parent && keptExpand !== undefined
                ? { expandParent: keptExpand }
                : {}),
        } as FlowNode;
        const position = features.constrainPosition(
            draft,
            moved,
            moved.position,
        );
        draft.putNode({ ...moved, position });
        features.nodeChanged(draft, nodeId);
        return ok({
            nodeId,
            position: draft.node(nodeId)?.position ?? position,
        });
    },
});
