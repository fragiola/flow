import {
    Flow,
    type FlowEdge,
    type FlowJson,
    type FlowModel,
    type FlowNode,
    type FlowTypes,
    useFlow,
    useFlowRef,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { type BeforeDelete, keyboard } from "@fragiola/flow-react/keyboard";
import { selection } from "@fragiola/flow-react/selection";
import { Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { reconnectionPlan } from "./reconnect";
import { styles } from "./styles";

// Deleting a node in the middle keeps the flow connected: each node that led into it is joined to
// each node it led to. The model tells the neighbours (`incomers-by`, `outgoers-by`) and the edges
// around them (`connected-edges-by`); `reconnect.ts` plans the new edges (no duplicate, no self
// loop), and one `batch` removes the node and adds them: one step, one undo.
//
// The delete key goes through `keyboard({ beforeDelete })`, which is asked before anything goes:
// it runs that batch itself and answers `false`, so the key removes nothing more. A middleware
// cannot do it: a command it issues runs after the removal, as a step of its own. Each node's
// delete button calls the same function.

interface Types extends FlowTypes {
    readonly nodes: { step: { label: string } };
}

const makeFeatures = (beforeDelete: BeforeDelete) =>
    [selection(), drag(), keyboard({ beforeDelete })] as const;

type Features = ReturnType<typeof makeFeatures>;

const step = (id: string, label: string, x: number, y: number) => ({
    id,
    type: "step" as const,
    position: { x, y },
    width: 150,
    height: 56,
    data: { label },
});

const link = (source: string, target: string) => ({
    id: `${source}-${target}`,
    source,
    target,
});

const json: FlowJson<Types> = {
    version: 1,
    nodes: [
        // a chain
        step("fetch", "Fetch", 0, 0),
        step("parse", "Parse", 280, 0),
        step("store", "Store", 560, 0),
        // a node with two incomers and two outgoers (Upload reaches Archive already)
        step("upload", "Upload", 0, 160),
        step("email", "Email", 0, 300),
        step("merge", "Merge", 280, 230),
        step("archive", "Archive", 560, 160),
        step("index", "Index", 560, 300),
    ],
    edges: [
        link("fetch", "parse"),
        link("parse", "store"),
        link("upload", "merge"),
        link("email", "merge"),
        link("merge", "archive"),
        link("merge", "index"),
        link("upload", "archive"),
    ],
};

/** The node's labels, for the edges' names and the status. */
const LABELS: Record<string, string> = Object.fromEntries(
    json.nodes.map((node) => [node.id, node.data.label]),
);

const labelOf = (id: string) => LABELS[id] ?? id;

/**
 * Removes the nodes (and the edges asked for) and joins their incomers to their outgoers, in one
 * `batch`; says whether it could.
 */
function removeReconnecting(
    model: FlowModel<Types, Features>,
    nodeIds: readonly string[],
    edgeIds: readonly string[] = [],
): boolean {
    // the neighbours, then every edge around the deleted nodes and them
    const around = new Set(nodeIds);
    for (const nodeId of nodeIds) {
        for (const node of model.get("incomers-by", { nodeId }))
            around.add(node.id);
        for (const node of model.get("outgoers-by", { nodeId }))
            around.add(node.id);
    }
    const edges = model.get("connected-edges-by", { nodeIds: [...around] });
    // a node's own edges go with it (and still join its neighbours): the other edges asked for
    // are removed one by one, and join nothing
    const gone = new Set(nodeIds);
    const loose = edgeIds.filter((edgeId) => {
        const edge = model.get("edge-by", { id: edgeId });
        return edge && !gone.has(edge.source) && !gone.has(edge.target);
    });
    const planned = reconnectionPlan(edges, nodeIds, {
        removedEdgeIds: loose,
        isTaken: (id) => model.get("edge-by", { id }) !== undefined,
    });
    const removed = nodeIds.map(labelOf).join(", ");
    const joinedNames = planned.map(
        (edge) => `${labelOf(edge.source)} to ${labelOf(edge.target)}`,
    );
    // what the status says, carried by the batch's meta to whoever listens
    const said =
        joinedNames.length === 0
            ? `Removed ${removed}.`
            : `Removed ${removed}; joined ${joinedNames.join(", ")}.`;
    return model.run(
        "batch",
        {
            commands: [
                ...nodeIds.map((nodeId) => ({
                    command: "node.remove" as const,
                    payload: { nodeId },
                })),
                ...loose.map((edgeId) => ({
                    command: "edge.remove" as const,
                    payload: { edgeId },
                })),
                ...planned.map((edge) => ({
                    command: "edge.add" as const,
                    payload: edge,
                })),
            ],
        },
        { meta: { said } },
    ).ok;
}

/** What the last deletion did: the `said` of the batches the model commits. */
function Status() {
    const { model } = useFlow<Types, Features>();
    const [said, setSaid] = useState(
        "Select a node and press Delete, or use its delete button.",
    );
    useEffect(
        () =>
            model.subscribe((event) => {
                if (typeof event.meta?.said === "string")
                    setSaid(event.meta.said);
            }),
        [model],
    );
    return (
        <p role="status" data-testid="outcome" className={styles.status}>
            {said}
        </p>
    );
}

/** The node's own delete button: a button inside a node is left alone by the flow's gestures. */
function DeleteButton({ node }: { node: FlowNode<Types> }) {
    const { model } = useFlow<Types, Features>();
    return (
        <button
            type="button"
            aria-label={`Delete ${node.data.label}`}
            onClick={() => removeReconnecting(model, [node.id])}
            className={styles.remove}
        >
            <Trash2Icon aria-hidden="true" />
        </button>
    );
}

function renderNode(node: FlowNode<Types>) {
    const { label } = node.data;
    return (
        <Flow.Node<Types>
            node={node}
            role="group"
            aria-roledescription="node"
            aria-label={label}
            className={styles.node}
        >
            <Flow.Handle type="target" side="left" className={styles.handle} />
            <span className={styles.label}>{label}</span>
            <DeleteButton node={node} />
            <Flow.Handle type="source" side="right" className={styles.handle} />
        </Flow.Node>
    );
}

function renderEdge(edge: FlowEdge<Types>) {
    return (
        <Flow.Edge<Types>
            edge={edge}
            role="group"
            aria-roledescription="edge"
            aria-label={`${labelOf(edge.source)} to ${labelOf(edge.target)}`}
            className={styles.edgeGroup}
        >
            <Flow.EdgePath className={styles.edge} />
        </Flow.Edge>
    );
}

export default function DeleteMiddleNode() {
    const flow = useFlowRef<Types, Features>();
    // the features are made once, their `beforeDelete` reaching the model through the flow's ref
    const [features] = useState(() =>
        makeFeatures((nodes, edges) => {
            const model = flow.current?.model;
            if (model) {
                removeReconnecting(
                    model,
                    nodes.map((node) => node.id),
                    edges.map((edge) => edge.id),
                );
            }
            // removed already, in the batch: the key removes nothing more
            return false;
        }),
    );

    return (
        <Flow.Root<Types, Features>
            features={features}
            defaultNodes={json.nodes}
            defaultEdges={json.edges}
            fitView={{ padding: 0.2, maxZoom: 1 }}
            flowRef={flow}
            role="group"
            aria-label="Delete middle node"
            className={styles.root}
        >
            <Flow.Background variant="dots" size={2} className={styles.dots} />
            <Flow.Background variant="lines" className={styles.lines} />
            <Flow.Background variant="cross" className={styles.cross} />
            <Flow.Viewport>
                <Flow.Edges<Types>>{renderEdge}</Flow.Edges>
                <Flow.Nodes<Types>>{renderNode}</Flow.Nodes>
            </Flow.Viewport>
            <Status />
        </Flow.Root>
    );
}
