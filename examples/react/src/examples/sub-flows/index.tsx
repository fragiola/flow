import {
    Flow,
    type FlowEdgeInput,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
    useFlow,
    useSelection,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { selection } from "@fragiola/flow-react/selection";
import { subflows } from "@fragiola/flow-react/subflows";
import { useEffect } from "react";
import { styles } from "./styles";

// `subflows()` gives a node a parent (`parentId`): its position is relative to the parent, it moves
// with it, and with `extent: "parent"` it stays inside it. Nodes are rendered flat (a child is not
// inside its parent's element), each at its absolute place. Drop a loose node onto a group and the
// app puts it in with `node.set-parent`, which keeps it where it is on screen. With
// `zIndexMode="auto"` (the default, written here to show it) an edge with an end in a group is
// drawn at its ends' level: above the groups it crosses, under the nodes it joins; a selected edge
// rises above every node. `"basic"` keeps every edge under every node, and `"manual"` follows only
// the `zIndex` values.
//
// "Group selection" wraps two or more selected top-level nodes in a new group sized to their box
// (`nodes-bounds`) plus a margin: one `batch` of `node.add` and a `node.set-parent` per node, so
// they keep their places and one undo takes it back. "Ungroup" puts the children of the selected
// groups back on the flow (`node.set-parent` to `null`) and removes the groups, in one `batch`
// too: removing a group first would remove its children with it.

interface Types extends FlowTypes {
    readonly nodes: {
        group: { label: string };
        item: { label: string };
    };
}

const features = [selection(), drag(), subflows()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "frontend",
        type: "group",
        position: { x: 0, y: 0 },
        width: 260,
        height: 220,
        data: { label: "Frontend" },
    },
    {
        id: "ui",
        type: "item",
        parentId: "frontend",
        extent: "parent",
        position: { x: 20, y: 50 },
        data: { label: "UI" },
    },
    {
        id: "state",
        type: "item",
        parentId: "frontend",
        extent: "parent",
        position: { x: 110, y: 140 },
        data: { label: "State" },
    },
    {
        id: "backend",
        type: "group",
        position: { x: 340, y: 0 },
        width: 260,
        height: 220,
        data: { label: "Backend" },
    },
    {
        id: "api",
        type: "item",
        parentId: "backend",
        extent: "parent",
        position: { x: 30, y: 60 },
        data: { label: "API" },
    },
    {
        id: "cache",
        type: "item",
        position: { x: 140, y: 280 },
        data: { label: "Cache (drop me in a group)" },
    },
    {
        id: "logs",
        type: "item",
        position: { x: 400, y: 280 },
        data: { label: "Logs" },
    },
];

/** The room a new group leaves around its nodes, and above them for its title. */
const MARGIN = 20;
const TITLE = 24;

const edges: FlowEdgeInput<Types>[] = [
    { id: "ui-state", source: "ui", target: "state" },
    { id: "state-api", source: "state", target: "api" },
];

/** Puts a dropped item into the group under its centre (or takes it out of its group). */
function DropIntoGroups() {
    const { model, engine } = useFlow<Types, typeof features>();
    useEffect(
        () =>
            engine.subscribe((event) => {
                if (event.type !== "nodes-move") return;
                for (const nodeId of event.nodeIds) {
                    const node = model.get("node-by", { id: nodeId });
                    if (node?.type !== "item") continue;
                    const rect = engine.get("node-rect-by", { nodeId });
                    if (!rect) continue;
                    const centre = {
                        x: rect.x + rect.width / 2,
                        y: rect.y + rect.height / 2,
                    };
                    const group = model.get("all-nodes").find((candidate) => {
                        if (candidate.type !== "group") return false;
                        const box = engine.get("node-rect-by", {
                            nodeId: candidate.id,
                        });
                        return (
                            box !== undefined &&
                            centre.x >= box.x &&
                            centre.x <= box.x + box.width &&
                            centre.y >= box.y &&
                            centre.y <= box.y + box.height
                        );
                    });
                    const parentId = group?.id ?? null;
                    if ((node.parentId ?? null) === parentId) continue;
                    model.run("node.set-parent", {
                        nodeId,
                        parentId,
                        extent: parentId ? "parent" : null,
                    });
                }
            }),
        [model, engine],
    );
    return null;
}

/** Groups the selected top-level nodes into a new group, and ungroups the selected groups. */
function Grouping() {
    const { model, engine } = useFlow<Types, typeof features>();
    const selected = useSelection<Types>().nodes;
    const loose = selected.filter((node) => node.parentId === undefined);
    const groups = selected.filter((node) => node.type === "group");

    function group() {
        const nodeIds = loose.map((node) => node.id);
        const bounds = engine.get("nodes-bounds", { nodeIds });
        if (!bounds) return;
        let count = 1;
        while (model.get("node-by", { id: `group-${count}` })) count += 1;
        const groupId = `group-${count}`;
        model.run("batch", {
            commands: [
                {
                    command: "node.add",
                    payload: {
                        id: groupId,
                        type: "group",
                        position: {
                            x: bounds.x - MARGIN,
                            y: bounds.y - MARGIN - TITLE,
                        },
                        width: bounds.width + 2 * MARGIN,
                        height: bounds.height + 2 * MARGIN + TITLE,
                        data: { label: `Group ${count}` },
                    },
                },
                ...nodeIds.map((nodeId) => ({
                    command: "node.set-parent" as const,
                    payload: {
                        nodeId,
                        parentId: groupId,
                        extent: "parent" as const,
                    },
                })),
                {
                    command: "selection.set",
                    payload: { nodeIds: [groupId], mode: "replace" },
                },
            ],
        });
    }

    function ungroup() {
        const groupIds = new Set(groups.map((node) => node.id));
        const children = model
            .get("all-nodes")
            .filter((node) => node.parentId && groupIds.has(node.parentId));
        model.run("batch", {
            commands: [
                ...children.map((node) => ({
                    command: "node.set-parent" as const,
                    payload: { nodeId: node.id, parentId: null, extent: null },
                })),
                ...[...groupIds].map((nodeId) => ({
                    command: "node.remove" as const,
                    payload: { nodeId },
                })),
            ],
        });
    }

    return (
        <div
            role="toolbar"
            aria-label="Grouping"
            data-flow-no-gesture
            className={styles.toolbar}
        >
            <button
                type="button"
                disabled={loose.length < 2}
                onClick={group}
                className={styles.button}
            >
                Group selection
            </button>
            <button
                type="button"
                disabled={groups.length === 0}
                onClick={ungroup}
                className={styles.button}
            >
                Ungroup
            </button>
        </div>
    );
}

function renderNode(node: FlowNode<Types>) {
    if (node.type === "group") {
        return (
            <Flow.Node<Types> node={node} className={styles.group}>
                <span className={styles.groupTitle}>{node.data.label}</span>
            </Flow.Node>
        );
    }
    return (
        <Flow.Node<Types> node={node} className={styles.node}>
            {node.data.label}
            <Flow.Handle type="target" side="top" className={styles.handle} />
            <Flow.Handle
                type="source"
                side="bottom"
                className={styles.handle}
            />
        </Flow.Node>
    );
}

export default function SubFlows() {
    return (
        <Flow.Root<Types, typeof features>
            features={features}
            defaultNodes={nodes}
            defaultEdges={edges}
            fitView={{ padding: 0.2, maxZoom: 1 }}
            zIndexMode="auto"
            className={styles.root}
        >
            <Flow.Background variant="dots" size={2} className={styles.dots} />
            <Flow.Background variant="lines" className={styles.lines} />
            <Flow.Background variant="cross" className={styles.cross} />
            <Flow.Viewport>
                <Flow.Edges<Types>>
                    {(edge) => (
                        <Flow.Edge<Types> edge={edge}>
                            <Flow.EdgePath className={styles.edge} />
                        </Flow.Edge>
                    )}
                </Flow.Edges>
                <Flow.Nodes<Types>>{renderNode}</Flow.Nodes>
            </Flow.Viewport>
            <DropIntoGroups />
            <Grouping />
        </Flow.Root>
    );
}
