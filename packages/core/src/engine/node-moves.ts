// What every gesture or key that moves nodes shares: the nodes a move carries (a selected node
// carries the selection; a node whose parent moves too is carried by it), their positions relative
// to their parents, and the commands that move them (one `node.move`, or a `batch` of them).
import type { BatchEntry } from "../commands/types";
import type { FlowNode, XY } from "../document/types";
import type { FeatureModel } from "../features/types";

/** The nodes a move of `nodeIds` moves: those without an ancestor among them, in their order. */
export function movedRoots(
    model: FeatureModel,
    nodeIds: readonly string[],
): string[] {
    const set = new Set(nodeIds);
    return nodeIds.filter((nodeId) => {
        const seen = new Set<string>();
        let parentId = (
            model.get("node-by", { id: nodeId }) as FlowNode | undefined
        )?.parentId;
        while (parentId !== undefined && !seen.has(parentId)) {
            if (set.has(parentId)) return false;
            seen.add(parentId);
            parentId = (
                model.get("node-by", { id: parentId }) as FlowNode | undefined
            )?.parentId;
        }
        return true;
    });
}

/** The nodes a move that starts on `nodeId` carries: the selection's draggable nodes when it is selected. */
export function carriedBy(model: FeatureModel, nodeId: string): string[] {
    if (!model.is("node-selected", { nodeId })) return [nodeId];
    const selected =
        (model.get("selected-nodes") as readonly FlowNode[] | undefined) ?? [];
    return movedRoots(
        model,
        selected
            .filter((node) => model.is("node-draggable", { nodeId: node.id }))
            .map((node) => node.id),
    );
}

/** The absolute position of a node's parent (its origin for a relative position); 0, 0 without one. */
export function parentOrigin(model: FeatureModel, nodeId: string): XY {
    const parentId = (
        model.get("node-by", { id: nodeId }) as FlowNode | undefined
    )?.parentId;
    const origin =
        parentId === undefined
            ? undefined
            : (model.get("absolute-position-by", { nodeId: parentId }) as
                  | XY
                  | undefined);
    return origin ?? { x: 0, y: 0 };
}

/** Runs moves as one step: one `node.move`, or a `batch` of them. */
export function runMoves(
    model: FeatureModel,
    moves: readonly { nodeId: string; position: XY }[],
    transient: boolean,
): boolean {
    if (moves.length === 0) return false;
    if (moves.length === 1) {
        const [move] = moves as [{ nodeId: string; position: XY }];
        return model.run("node.move", move, { transient }).ok;
    }
    const commands: BatchEntry[] = moves.map((payload) => ({
        command: "node.move",
        payload,
    }));
    return model.run("batch", { commands }, { transient }).ok;
}
