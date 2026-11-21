// The sub-flows feature (D2, `@fragiola/flow/subflows`): a node may live in another (`parentId`),
// its position relative to its parent; with `extent: "parent"` it stays inside its parent's box,
// and with `expandParent` its parent grows to keep it inside. Removing a parent removes its
// children. The model keeps these rules with the sizes the document gives (`width`, `height`); the
// engine (fragiola/flow#3) keeps them during a drag with the measured ones. A rectangle `extent`
// (a field of this feature too, D3) is kept by the engine only, during drags, arrows and resizes.
import { fail } from "../commands/define";
import type { FlowNode, XY } from "../document/types";
import type { FlowFeature, FlowReader } from "../features/types";
import type { ValidationIssue } from "../schema/types";
import { stringOf } from "../state/core-queries";
import type { Draft } from "../state/draft";
import { nodeSetParent } from "./commands";
import {
    absolutePositionOf,
    childrenOf,
    descendantsOf,
    inCycle,
} from "./hierarchy";

/** Options of {@link subflows}: none yet. */
export type SubflowsOptions = Record<never, never>;

/** The sub-flows feature, as `subflows()` makes it. */
export type SubflowsFeature = FlowFeature<"subflows", SubflowsOptions>;

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), Math.max(min, max));
}

/** A node's position kept inside its parent's box (`extent: "parent"`), as far as sizes are known. */
function keptInParent(draft: Draft, node: FlowNode, position: XY): XY {
    if (
        node.parentId === undefined ||
        node.extent !== "parent" ||
        node.expandParent === true
    ) {
        return position;
    }
    const parent = draft.node(node.parentId);
    if (!parent) {
        return position;
    }
    return {
        x: clamp(position.x, 0, (parent.width ?? Infinity) - (node.width ?? 0)),
        y: clamp(
            position.y,
            0,
            (parent.height ?? Infinity) - (node.height ?? 0),
        ),
    };
}

/**
 * Grows a node's parent to hold it (`expandParent`): past its left or top edge, the parent moves
 * there and grows, its children shifted back so nothing moves on screen; past its right or bottom
 * edge, it grows (when it has a size). A parent that expands its own parent follows.
 */
function expandParentOf(
    draft: Draft,
    nodeId: string,
    seen = new Set<string>(),
): void {
    const node = draft.node(nodeId);
    if (
        node?.expandParent !== true ||
        node.parentId === undefined ||
        seen.has(nodeId)
    ) {
        return;
    }
    seen.add(nodeId);
    const parent = draft.node(node.parentId);
    if (!parent) {
        return;
    }
    const dx = Math.min(0, node.position.x);
    const dy = Math.min(0, node.position.y);
    if (dx < 0 || dy < 0) {
        for (const child of childrenOf(draft, parent.id)) {
            draft.putNode({
                ...child,
                position: {
                    x: child.position.x - dx,
                    y: child.position.y - dy,
                },
            });
        }
    }
    const moved = draft.node(nodeId) ?? node;
    const right = moved.position.x + (moved.width ?? 0);
    const bottom = moved.position.y + (moved.height ?? 0);
    const width =
        parent.width === undefined
            ? undefined
            : Math.max(parent.width - dx, right);
    const height =
        parent.height === undefined
            ? undefined
            : Math.max(parent.height - dy, bottom);
    const grown: FlowNode = {
        ...parent,
        position: { x: parent.position.x + dx, y: parent.position.y + dy },
        ...(width === undefined ? {} : { width }),
        ...(height === undefined ? {} : { height }),
    };
    if (
        grown.position.x !== parent.position.x ||
        grown.position.y !== parent.position.y ||
        grown.width !== parent.width ||
        grown.height !== parent.height
    ) {
        draft.putNode(grown);
        expandParentOf(draft, parent.id, seen);
    }
}

/** The document's sub-flow problems: a parent that does not exist, or a cycle of parents. */
function hierarchyIssues(reader: FlowReader): ValidationIssue[] {
    return reader.nodes().flatMap((node, i): ValidationIssue[] => {
        if (node.parentId === undefined) {
            return [];
        }
        const path = `/nodes/${i}/parentId`;
        if (!reader.node(node.parentId)) {
            return [{ path, message: `no node "${node.parentId}"` }];
        }
        return inCycle(reader, node.id)
            ? [{ path, message: `node "${node.id}" is its own ancestor` }]
            : [];
    });
}

/** Nodes inside nodes: `features: [subflows()]` (`@fragiola/flow/subflows`). */
export function subflows(): SubflowsFeature {
    return Object.freeze({
        name: "subflows",
        options: Object.freeze({}),
        commands: [nodeSetParent],
        get: {
            "node-children-by": (reader: FlowReader, payload: unknown) => {
                const nodeId = stringOf(payload, "nodeId");
                return nodeId === undefined ? [] : childrenOf(reader, nodeId);
            },
            "node-parent-by": (reader: FlowReader, payload: unknown) => {
                const nodeId = stringOf(payload, "nodeId");
                const parentId =
                    nodeId === undefined
                        ? undefined
                        : reader.node(nodeId)?.parentId;
                return parentId === undefined
                    ? undefined
                    : reader.node(parentId);
            },
        },
        documentIssues: hierarchyIssues,
        checkNode: (draft, node, path) => {
            if (node.parentId === undefined) {
                return undefined;
            }
            if (node.parentId === node.id) {
                return fail(
                    "refused",
                    "a node cannot be its own parent",
                    `${path}/parentId`,
                );
            }
            return draft.node(node.parentId)
                ? undefined
                : fail(
                      "not_found",
                      `no node "${node.parentId}"`,
                      `${path}/parentId`,
                  );
        },
        removing: (draft, nodeIds) => {
            for (const id of [...nodeIds]) {
                for (const descendant of descendantsOf(draft, id)) {
                    nodeIds.add(descendant);
                }
            }
        },
        constrainPosition: keptInParent,
        nodeChanged: (draft, nodeId) => expandParentOf(draft, nodeId),
        absolutePosition: absolutePositionOf,
    } satisfies SubflowsFeature);
}
