import {
    Flow,
    type FlowEdgeInput,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
    useFlow,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { selection } from "@fragiola/flow-react/selection";
import { subflows } from "@fragiola/flow-react/subflows";
import { useEffect } from "react";
import { styles } from "./styles";

// `subflows()` gives a node a parent (`parentId`): its position is relative to the parent, it moves
// with it, and with `extent: "parent"` it stays inside it. Nodes are rendered flat (a child is not
// inside its parent's element), each at its absolute place. Drop a loose node onto a group and the
// app puts it in with `node.set-parent`, which keeps it where it is on screen.

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
        position: { x: 180, y: 280 },
        data: { label: "Cache (drop me in a group)" },
    },
];

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
        </Flow.Root>
    );
}
