import {
    Flow,
    type FlowDocumentJson,
    type FlowNodeInput,
    type FlowTypes,
    useFlow,
    useNodes,
    type Viewport,
} from "@fragiola/flow-react";
import { connection } from "@fragiola/flow-react/connection";
import { drag } from "@fragiola/flow-react/drag";
import { selection } from "@fragiola/flow-react/selection";
import { PlusIcon, RotateCcwIcon, SaveIcon } from "lucide-react";
import { useState } from "react";
import { load, save } from "../_kit/persistence";
import { styles } from "./styles";

// The document is plain JSON: `model.get("flow-json")` is everything to save (nodes, edges, the
// selection), and the viewport is the engine's (`engine.get("viewport")`). Restoring brings the
// live model to the saved document with the commands a user would have run
// (`model.get("commands-to", …)`, one `batch`) and sets the viewport back. Nothing remounts.

interface Types extends FlowTypes {
    readonly nodes: { topic: { label: string } };
}

const features = [selection(), drag(), connection()] as const;

const KEY = "fragiola-flow-example:save-and-restore";

interface Saved {
    flow: FlowDocumentJson<Types>;
    viewport: Viewport;
}

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "plan",
        type: "topic",
        position: { x: 0, y: 0 },
        data: { label: "Plan" },
    },
    {
        id: "write",
        type: "topic",
        position: { x: 200, y: 100 },
        data: { label: "Write" },
    },
];

function Toolbar() {
    const { model, engine } = useFlow<Types, typeof features>();
    const count = useNodes<Types>().length;
    const [message, setMessage] = useState(
        load<Saved>(KEY) ? "A saved flow is waiting." : "Nothing saved yet.",
    );

    function onSave() {
        const saved: Saved = {
            flow: model.get("flow-json"),
            viewport: engine.get("viewport"),
        };
        setMessage(
            save(KEY, saved)
                ? `Saved ${saved.flow.nodes.length} nodes.`
                : "Storage is unavailable.",
        );
    }

    function onRestore() {
        const saved = load<Saved>(KEY);
        if (!saved) {
            setMessage("Nothing saved yet.");
            return;
        }
        const commands = model.get("commands-to", {
            nodes: saved.flow.nodes,
            edges: saved.flow.edges,
        });
        if (commands.length > 0)
            model.run("batch", { commands: [...commands] });
        engine.run("set-viewport", saved.viewport);
        setMessage(`Restored ${saved.flow.nodes.length} nodes.`);
    }

    function onAdd() {
        const { x, y, zoom } = engine.get("viewport");
        const size = engine.get("root-size");
        model.run("node.add", {
            type: "topic",
            // somewhere in view, in flow coordinates
            position: {
                x:
                    (size.width / 2 - x) / zoom -
                    60 +
                    Math.round(Math.random() * 120 - 60),
                y:
                    (size.height / 2 - y) / zoom -
                    20 +
                    Math.round(Math.random() * 120 - 60),
            },
            data: { label: `Topic ${count + 1}` },
        });
    }

    return (
        <div role="toolbar" aria-label="Flow file" className={styles.panel}>
            <button type="button" onClick={onAdd} className={styles.button}>
                <PlusIcon />
                Add a node
            </button>
            <button type="button" onClick={onSave} className={styles.primary}>
                <SaveIcon />
                Save
            </button>
            <button type="button" onClick={onRestore} className={styles.button}>
                <RotateCcwIcon />
                Restore
            </button>
            <p role="status" data-testid="message" className={styles.message}>
                {message}
            </p>
        </div>
    );
}

export default function SaveAndRestore() {
    return (
        <Flow.Root<Types, typeof features>
            features={features}
            defaultNodes={nodes}
            defaultEdges={[
                { id: "plan-write", source: "plan", target: "write" },
            ]}
            defaultViewport={{ x: 120, y: 120, zoom: 1 }}
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
                <Flow.Nodes<Types>>
                    {(node) => (
                        <Flow.Node<Types> node={node} className={styles.node}>
                            {node.data.label}
                            <Flow.Handle
                                type="target"
                                side="top"
                                className={styles.handle}
                            />
                            <Flow.Handle
                                type="source"
                                side="bottom"
                                className={styles.handle}
                            />
                        </Flow.Node>
                    )}
                </Flow.Nodes>
                <Flow.ConnectionLine className={styles.connection} />
            </Flow.Viewport>
            <Toolbar />
        </Flow.Root>
    );
}
