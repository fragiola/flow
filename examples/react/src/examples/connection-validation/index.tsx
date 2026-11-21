import {
    createFlowModel,
    Flow,
    type FlowEdge,
    type FlowJson,
    type FlowModel,
    type FlowNode,
    type FlowTypes,
    type Middleware,
    useFlow,
    veto,
} from "@fragiola/flow-react";
import { connection } from "@fragiola/flow-react/connection";
import { drag } from "@fragiola/flow-react/drag";
import { selection } from "@fragiola/flow-react/selection";
import { useEffect, useState } from "react";
import { styles } from "./styles";

// Connection rules are middleware, not a callback: `model.use` sees every `edge.add`, from a drag
// or from code, and vetoes what it refuses. While a connection is drawn, the engine asks the model
// (`model.can("edge.add", …)`), so a refused handle is marked `data-invalid` before the drop and the
// drop adds nothing. The rules: a port joins a port of its own type, no cycle, one edge per input.

type Port = "number" | "text";

const PORTS: Port[] = ["number", "text"];

interface Types extends FlowTypes {
    readonly nodes: {
        block: { label: string; inputs: Port[]; outputs: Port[] };
    };
}

const features = [selection(), drag(), connection()] as const;

/** A handle id says its port's type: `number-0`, `text-1`. */
const portType = (handleId: string | undefined) =>
    handleId?.split("-")[0] as Port | undefined;

/** Whether `to` reaches `from` already: an edge from `from` to `to` would close a cycle. */
function reaches(
    edges: readonly FlowEdge<Types>[],
    to: string,
    from: string,
): boolean {
    const seen = new Set<string>();
    const queue = [to];
    while (queue.length > 0) {
        const id = queue.shift() as string;
        if (id === from) return true;
        if (seen.has(id)) continue;
        seen.add(id);
        for (const edge of edges)
            if (edge.source === id) queue.push(edge.target);
    }
    return false;
}

/** The rules, as a middleware: anything it returns without calling `next` is a veto. */
const connectionRules: Middleware<Types, typeof features> = (ctx, next) => {
    if (ctx.command !== "edge.add") return next();
    const { source, target, sourceHandle, targetHandle } = ctx.payload;
    if (portType(sourceHandle) !== portType(targetHandle)) {
        return veto("a port only joins a port of its own type");
    }
    if (source === target || reaches(ctx.state.edges, target, source)) {
        return veto("that edge would close a cycle");
    }
    const taken = ctx.state.edges.some(
        (edge) => edge.target === target && edge.targetHandle === targetHandle,
    );
    if (taken) return veto("that input already has an edge");
    return next();
};

const json: FlowJson<Types> = {
    version: 1,
    nodes: [
        {
            id: "count",
            type: "block",
            position: { x: 0, y: 0 },
            data: { label: "Count", inputs: [], outputs: ["number"] },
        },
        {
            id: "name",
            type: "block",
            position: { x: 0, y: 160 },
            data: { label: "Name", inputs: [], outputs: ["text"] },
        },
        {
            id: "format",
            type: "block",
            position: { x: 260, y: 60 },
            data: {
                label: "Format",
                inputs: ["number", "text"],
                outputs: ["text"],
            },
        },
        {
            id: "print",
            type: "block",
            position: { x: 520, y: 90 },
            data: { label: "Print", inputs: ["text"], outputs: ["text"] },
        },
    ],
    edges: [
        {
            id: "count-format",
            source: "count",
            target: "format",
            sourceHandle: "number-0",
            targetHandle: "number-0",
        },
    ],
};

function renderNode(node: FlowNode<Types>) {
    const { inputs, outputs } = node.data;
    return (
        <Flow.Node<Types> node={node} className={styles.node}>
            <span className={styles.title}>{node.data.label}</span>
            {inputs.map((port, index) => (
                <Flow.Handle
                    key={`in-${port}`}
                    type="target"
                    side="left"
                    handleId={`${port}-${index}`}
                    title={`${port} input`}
                    className={styles.port(port)}
                    style={{
                        top: `${((index + 1) * 100) / (inputs.length + 1)}%`,
                    }}
                />
            ))}
            {outputs.map((port, index) => (
                <Flow.Handle
                    key={`out-${port}`}
                    type="source"
                    side="right"
                    handleId={`${port}-${index}`}
                    title={`${port} output`}
                    className={styles.port(port)}
                    style={{
                        top: `${((index + 1) * 100) / (outputs.length + 1)}%`,
                    }}
                />
            ))}
        </Flow.Node>
    );
}

/** The legend, and how the last connection ended (the engine's events, inside the root). */
function Outcome() {
    const { engine } = useFlow<Types, typeof features>();
    const [outcome, setOutcome] = useState("Drag from an output to an input.");
    useEffect(
        () =>
            engine.subscribe((event) => {
                if (event.type === "connect") setOutcome("Connected.");
                if (event.type === "connect-cancel") {
                    setOutcome(
                        event.refused
                            ? "Refused: the rules do not allow that connection."
                            : "Dropped nowhere: nothing changed.",
                    );
                }
            }),
        [engine],
    );
    return (
        <div className={styles.legend}>
            {PORTS.map((port) => (
                <span key={port} className={styles.key(port)}>
                    {port}
                </span>
            ))}
            <p role="status" data-testid="outcome" className={styles.outcome}>
                {outcome}
            </p>
        </div>
    );
}

export default function ConnectionValidation() {
    // the model is made once, with its middleware, and handed to the root
    const [model] = useState<FlowModel<Types, typeof features>>(() => {
        const created = createFlowModel<Types, typeof features>(json, {
            features,
        });
        created.use(connectionRules);
        return created;
    });
    return (
        <Flow.Root<Types, typeof features>
            model={model}
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
                <Flow.ConnectionLine className={styles.connection} />
            </Flow.Viewport>
            <Outcome />
        </Flow.Root>
    );
}
