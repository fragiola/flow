import {
    Flow,
    type FlowEngineEvent,
    type FlowModel,
    type FlowNodeInput,
    type FlowTypes,
    useFlow,
} from "@fragiola/flow-react";
import { connection } from "@fragiola/flow-react/connection";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import { selection } from "@fragiola/flow-react/selection";
import { useEffect, useState } from "react";
import { styles } from "./styles";

// The package says nothing aloud: it has no text. The engine tells what happened
// (`engine.subscribe`: nodes moved, an edge connected, something removed), and the app writes it,
// in its own words and language, into a live region a screen reader reads (`role="status"`). The
// log beside it shows the same messages. Try it with the keyboard: Tab to a node, move it with the
// arrows, delete it with Delete; or Tab to a handle and press Enter: each target the connection
// points at is announced (`connect-target`, its `index` of `count`) until Enter connects.

interface Types extends FlowTypes {
    readonly nodes: { room: { label: string } };
}

const features = [selection(), drag(), connection(), keyboard()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "hall",
        type: "room",
        position: { x: 0, y: 0 },
        data: { label: "Hall" },
    },
    {
        id: "kitchen",
        type: "room",
        position: { x: 220, y: 0 },
        data: { label: "Kitchen" },
    },
    {
        id: "garden",
        type: "room",
        position: { x: 110, y: 140 },
        data: { label: "Garden" },
    },
];

type Model = FlowModel<Types, typeof features>;

/**
 * The app's words for an engine event, or nothing for one it keeps quiet about. `startedFrom`:
 * the node a keyboard connection has just started from, said with its first target (both come
 * at once, and a live region reads only the last message) with the keys to use.
 */
function describe(
    event: FlowEngineEvent,
    model: Model,
    startedFrom?: string,
): string | undefined {
    const name = (id: string) => model.get("node-by", { id })?.data.label ?? id;
    const names = (ids: readonly string[]) => ids.map(name).join(", ");
    switch (event.type) {
        case "nodes-move":
            return `Moved ${names(event.nodeIds)}${event.source === "keyboard" ? " with the keyboard" : ""}.`;
        case "drag-cancel":
            return `Put ${names(event.nodeIds)} back.`;
        case "connect-target": {
            const target =
                event.nodeId === undefined
                    ? "No handle accepts this connection."
                    : `Target ${event.index + 1} of ${event.count}: ${name(event.nodeId)}.`;
            if (startedFrom === undefined) return target;
            const keys =
                event.nodeId === undefined
                    ? "Escape to cancel."
                    : "Tab for the next, Enter to connect, Escape to cancel.";
            return `Connecting from ${name(startedFrom)}. ${target} ${keys}`;
        }
        case "connect":
            return `Connected ${name(event.source)} to ${name(event.target)}${event.input === "keyboard" ? " with the keyboard" : ""}.`;
        case "connect-cancel":
            if (event.refused) return "That connection is not allowed.";
            return event.input === "keyboard"
                ? "Connection cancelled."
                : undefined;
        case "remove": {
            const parts = [
                event.nodeIds.length > 0
                    ? `${event.nodeIds.length} node(s)`
                    : "",
                event.edgeIds.length > 0
                    ? `${event.edgeIds.length} edge(s)`
                    : "",
            ].filter(Boolean);
            return `Removed ${parts.join(" and ")}.`;
        }
        default:
            return undefined;
    }
}

function LiveRegion() {
    const { model, engine } = useFlow<Types, typeof features>();
    const [log, setLog] = useState<string[]>([]);
    useEffect(() => {
        // a keyboard connection that has just started, until its first target
        let startedFrom: string | undefined;
        return engine.subscribe((event) => {
            if (event.type === "connect-start") {
                startedFrom =
                    event.input === "keyboard" ? event.nodeId : undefined;
            }
            const message = describe(event, model, startedFrom);
            if (event.type === "connect-target") startedFrom = undefined;
            if (message)
                setLog((previous) => [message, ...previous].slice(0, 6));
        });
    }, [model, engine]);
    return (
        <aside aria-label="What happened" className={styles.panel}>
            {/* read aloud: only the latest message */}
            <p
                role="status"
                data-testid="announcement"
                className={styles.latest}
            >
                {log[0] ?? "Move, connect or delete a node."}
            </p>
            <ol aria-label="Earlier" className={styles.log}>
                {log.slice(1).map((message, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: the log is a stack
                    <li key={index}>{message}</li>
                ))}
            </ol>
        </aside>
    );
}

export default function Announcements() {
    return (
        <Flow.Root<Types, typeof features>
            features={features}
            defaultNodes={nodes}
            defaultEdges={[
                { id: "hall-kitchen", source: "hall", target: "kitchen" },
            ]}
            fitView={{ padding: 0.2, maxZoom: 1 }}
            className={styles.root}
        >
            <Flow.Background variant="dots" size={2} className={styles.dots} />
            <Flow.Background variant="lines" className={styles.lines} />
            <Flow.Background variant="cross" className={styles.cross} />
            <Flow.Viewport>
                <Flow.Edges<Types>>
                    {(edge) => (
                        <Flow.Edge<Types>
                            edge={edge}
                            role="group"
                            aria-roledescription="edge"
                            aria-label={`${edge.source} to ${edge.target}`}
                            className={styles.edgeGroup}
                        >
                            <Flow.EdgePath className={styles.edge} />
                        </Flow.Edge>
                    )}
                </Flow.Edges>
                <Flow.Nodes<Types>>
                    {(node) => (
                        <Flow.Node<Types>
                            node={node}
                            role="group"
                            aria-roledescription="node"
                            aria-label={node.data.label}
                            className={styles.node}
                        >
                            {node.data.label}
                            <Flow.Handle
                                type="target"
                                side="top"
                                aria-label={`${node.data.label} input`}
                                className={styles.handle}
                            />
                            <Flow.Handle
                                type="source"
                                side="bottom"
                                aria-label={`${node.data.label} output`}
                                className={styles.handle}
                            />
                        </Flow.Node>
                    )}
                </Flow.Nodes>
                <Flow.ConnectionLine className={styles.connection} />
            </Flow.Viewport>
            <LiveRegion />
        </Flow.Root>
    );
}
