import {
    Flow,
    type FlowEdge,
    type FlowEdgeInput,
    type FlowEngine,
    type FlowModel,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
    useFlowRef,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { selection } from "@fragiola/flow-react/selection";
import { useEffect, useRef, useState } from "react";
import {
    ALGORITHMS,
    type Algorithm,
    type LayoutNode,
    layoutGraph,
    type Placement,
} from "./layout";
import { styles } from "./styles";

// A data pipeline laid out by ELK (`layout.ts`): its nodes declare their size and have several
// named inputs (left) and outputs (right), each edge joins two of them. Each handle is an ELK port
// on its side, and ELK may reorder the ports of a side to uncross the edges. The document opens
// in a naive order (the edges cross); once mounted, ELK lays it out (async): in ONE `batch`, each
// node's `node.set-data` takes the handle order ELK chose (the handles are keyed by their side's
// order, so they remount and the engine measures them again) and `node.move` its place; then `fit-view`
// animated. "Algorithm" lays it out again, "Layered" or "Tree" (`mrtree`); a request id keeps a
// layout that resolves after a newer one was asked for from applying. The root carries
// `data-algorithm` and `data-layout="running" | "done"`.

interface Types extends FlowTypes {
    readonly nodes: {
        stage: { label: string; inputs: string[]; outputs: string[] };
    };
}

const features = [selection(), drag()] as const;

/** Every node's width, and the rows its height is made of, in flow units (`styles.ts`). */
const WIDTH = 170;
const TITLE = 28;
const ROW = 20;
const PADDING = 8;

/** How the view fits the pipeline: some room around it, never zoomed in past 1. */
const FIT = { padding: 0.15, maxZoom: 1 };

const FIRST: Algorithm = "layered";

type Stage = readonly [
    id: string,
    label: string,
    inputs: readonly string[],
    outputs: readonly string[],
];

/**
 * The pipeline: three sources joined, sessionized and enriched into a warehouse, with a quality
 * report of what failed. The handles are listed in an order that crosses the edges (Join's
 * "customers" above "orders", whose source is above), for ELK to put right.
 */
const STAGES: readonly Stage[] = [
    ["quality", "Quality report", ["errors", "unmatched"], []],
    ["orders", "Orders API", [], ["records"]],
    ["enrich", "Enrich", ["sessions", "matched"], ["errors", "profiles"]],
    ["customers", "Customers DB", [], ["rows"]],
    ["join", "Join", ["customers", "orders"], ["unmatched", "matched"]],
    ["dashboard", "Dashboard", ["tables"], []],
    ["clicks", "Clickstream", [], ["events"]],
    ["warehouse", "Warehouse", ["bounces", "profiles"], ["tables"]],
    ["sessions", "Sessionize", ["events"], ["bounces", "sessions"]],
];

/** Each edge: source node and output, target node and input. */
const LINKS: readonly (readonly [
    source: string,
    output: string,
    target: string,
    input: string,
])[] = [
    ["orders", "records", "join", "orders"],
    ["customers", "rows", "join", "customers"],
    ["clicks", "events", "sessions", "events"],
    ["join", "matched", "enrich", "matched"],
    ["join", "unmatched", "quality", "unmatched"],
    ["sessions", "sessions", "enrich", "sessions"],
    ["sessions", "bounces", "warehouse", "bounces"],
    ["enrich", "profiles", "warehouse", "profiles"],
    ["enrich", "errors", "quality", "errors"],
    ["warehouse", "tables", "dashboard", "tables"],
];

const LABELS: Record<string, string> = Object.fromEntries(
    STAGES.map(([id, label]) => [id, label]),
);

const labelOf = (id: string) => LABELS[id] ?? id;

const heightOf = (inputs: number, outputs: number) =>
    TITLE + ROW * Math.max(1, inputs, outputs) + PADDING;

// a naive placement: a grid in the list's order, where the edges cross; ELK replaces it on open
const nodes: FlowNodeInput<Types>[] = STAGES.map(
    ([id, label, inputs, outputs], index) => ({
        id,
        type: "stage",
        position: { x: (index % 3) * 240, y: Math.floor(index / 3) * 130 },
        width: WIDTH,
        height: heightOf(inputs.length, outputs.length),
        data: { label, inputs: [...inputs], outputs: [...outputs] },
    }),
);

const edges: FlowEdgeInput<Types>[] = LINKS.map(
    ([source, output, target, input]) => ({
        id: `${source}-${target}`,
        source,
        target,
        sourceHandle: output,
        targetHandle: input,
    }),
);

const ALGORITHM_NAMES: Record<Algorithm, string> = {
    layered: "Layered",
    mrtree: "Tree",
};

/** What the layout reads of a node: its id, declared size and handles. */
const layoutNodeOf = (node: FlowNode<Types>): LayoutNode => ({
    id: node.id,
    width: node.width ?? WIDTH,
    height:
        node.height ??
        heightOf(node.data.inputs.length, node.data.outputs.length),
    inputs: node.data.inputs,
    outputs: node.data.outputs,
});

/** Lays the flow's document out with ELK: every node's place and handle order. */
function layout(
    model: FlowModel<Types, typeof features>,
    algorithm: Algorithm,
) {
    return layoutGraph(
        model.get("all-nodes").map(layoutNodeOf),
        model.get("all-edges"),
        algorithm,
    );
}

/**
 * Applies ELK's result as ONE change: each node's handle order and its place, in one `batch`
 * (one step for a history or a save); then fits the view to it, animated, once the engine can.
 */
function apply(
    model: FlowModel<Types, typeof features>,
    engine: FlowEngine<Types, typeof features>,
    placements: ReadonlyMap<string, Placement>,
) {
    model.run("batch", {
        commands: [...placements].flatMap(([nodeId, placement]) => [
            {
                command: "node.set-data" as const,
                payload: {
                    nodeId,
                    data: {
                        inputs: [...placement.inputs],
                        outputs: [...placement.outputs],
                    },
                },
            },
            {
                command: "node.move" as const,
                payload: { nodeId, position: placement.position },
            },
        ]),
    });
    // before `ready` the root's own `fitView` fits the laid-out nodes once they are measured
    if (engine.is("ready")) engine.run("fit-view", { ...FIT, duration: 300 });
}

function renderNode(node: FlowNode<Types>) {
    const { label, inputs, outputs } = node.data;
    // a side's handles are keyed by that side's order: a new order remounts them, so the engine
    // measures their new centres (it does so when a handle registers)
    const inputOrder = inputs.join(",");
    const outputOrder = outputs.join(",");
    return (
        <Flow.Node<Types>
            node={node}
            role="group"
            aria-roledescription="node"
            aria-label={label}
            data-position={`${Math.round(node.position.x)}, ${Math.round(node.position.y)}`}
            className={styles.node}
        >
            <span className={styles.title}>{label}</span>
            <span className={styles.ports}>
                <span className={styles.column}>
                    {inputs.map((input) => (
                        <span
                            key={`${inputOrder}/${input}`}
                            className={styles.inputRow}
                        >
                            <Flow.Handle
                                type="target"
                                side="left"
                                handleId={input}
                                className={styles.handle}
                            />
                            {input}
                        </span>
                    ))}
                </span>
                <span className={styles.column}>
                    {outputs.map((output) => (
                        <span
                            key={`${outputOrder}/${output}`}
                            className={styles.outputRow}
                        >
                            {output}
                            <Flow.Handle
                                type="source"
                                side="right"
                                handleId={output}
                                className={styles.handle}
                            />
                        </span>
                    ))}
                </span>
            </span>
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

export default function ElkLayout() {
    const flow = useFlowRef<Types, typeof features>();
    const [algorithm, setAlgorithm] = useState<Algorithm>(FIRST);
    const [running, setRunning] = useState(true);
    // the latest layout asked for: an older one that resolves later is dropped
    const request = useRef(0);

    function arrange(next: Algorithm) {
        const current = flow.current;
        if (!current) return;
        const { model, engine } = current;
        request.current += 1;
        const id = request.current;
        setAlgorithm(next);
        setRunning(true);
        void layout(model, next).then((placements) => {
            if (id !== request.current) return;
            apply(model, engine, placements);
            setRunning(false);
        });
    }

    // the first layout, once mounted (the model is there); leaving drops a pending one
    // biome-ignore lint/correctness/useExhaustiveDependencies: once, on mount
    useEffect(() => {
        arrange(FIRST);
        return () => {
            request.current += 1;
        };
    }, []);

    return (
        <Flow.Root<Types, typeof features>
            features={features}
            defaultNodes={nodes}
            defaultEdges={edges}
            fitView={FIT}
            flowRef={flow}
            role="group"
            aria-label="ELK layout"
            data-algorithm={algorithm}
            data-layout={running ? "running" : "done"}
            className={styles.root}
        >
            <Flow.Background variant="dots" size={2} className={styles.dots} />
            <Flow.Background variant="lines" className={styles.lines} />
            <Flow.Background variant="cross" className={styles.cross} />
            <Flow.Viewport>
                <Flow.Edges<Types>>{renderEdge}</Flow.Edges>
                <Flow.Nodes<Types>>{renderNode}</Flow.Nodes>
            </Flow.Viewport>
            <fieldset className={styles.panel}>
                <legend className={styles.legend}>Algorithm</legend>
                {ALGORITHMS.map((option) => (
                    <label key={option} className={styles.option}>
                        <input
                            type="radio"
                            name="elk-algorithm"
                            value={option}
                            checked={algorithm === option}
                            onChange={() => arrange(option)}
                            className={styles.radio}
                        />
                        {ALGORITHM_NAMES[option]}
                    </label>
                ))}
            </fieldset>
        </Flow.Root>
    );
}
