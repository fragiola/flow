import {
    createFlowModel,
    Flow,
    type FlowEdgeInput,
    type FlowNodeInput,
    type FlowTypes,
} from "@fragiola/flow-react";
import { connection } from "@fragiola/flow-react/connection";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import { selection } from "@fragiola/flow-react/selection";
import { Redo2Icon, Undo2Icon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
    createUndoHistory,
    handleUndoKeys,
    type UndoHistory,
} from "../_kit/undo";
import { styles } from "./styles";

// Undo is app policy: `_kit/undo.ts` (copy it) listens to the model and keeps the documents before
// each step. A drag is one step (its transient moves end with a final one), and so is a connection
// or a deletion (Delete removes the selection with its edges, in one command). Selecting is not a
// step. Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z redoes.

interface Types extends FlowTypes {
    readonly nodes: { block: { label: string } };
}

const features = [selection(), drag(), connection(), keyboard()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "a",
        type: "block",
        position: { x: 0, y: 0 },
        data: { label: "Drag" },
    },
    {
        id: "b",
        type: "block",
        position: { x: 220, y: 0 },
        data: { label: "Connect" },
    },
    {
        id: "c",
        type: "block",
        position: { x: 110, y: 140 },
        data: { label: "Delete" },
    },
];

const edges: FlowEdgeInput<Types>[] = [{ id: "a-c", source: "a", target: "c" }];

function History({ history }: { history: UndoHistory }) {
    const snapshot = useSyncExternalStore(
        history.subscribe,
        history.getSnapshot,
    );
    return (
        <div className={styles.panel}>
            <div role="toolbar" aria-label="History" className={styles.buttons}>
                <button
                    type="button"
                    aria-label="Undo"
                    disabled={!snapshot.canUndo}
                    onClick={() => history.undo()}
                    className={styles.button}
                >
                    <Undo2Icon />
                </button>
                <button
                    type="button"
                    aria-label="Redo"
                    disabled={!snapshot.canRedo}
                    onClick={() => history.redo()}
                    className={styles.button}
                >
                    <Redo2Icon />
                </button>
            </div>
            <ol aria-label="Steps" data-testid="steps" className={styles.steps}>
                {snapshot.undoSteps.map((step, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: the steps are a stack
                    <li key={index} className={styles.step}>
                        {step}
                    </li>
                ))}
            </ol>
        </div>
    );
}

export default function UndoRedo() {
    // the model is made here, so that the history and the shortcuts sit beside the root
    const [model] = useState(() =>
        createFlowModel<Types, typeof features>(
            { version: 1, nodes, edges },
            { features },
        ),
    );
    // made in an effect, so that StrictMode's second mount gets a history that listens again
    const [history, setHistory] = useState<UndoHistory | null>(null);
    useEffect(() => {
        const created = createUndoHistory(model);
        setHistory(created);
        // the shortcuts, on the window: a Delete leaves the focus on the page, not in the flow
        // (an app with other editable content would scope them to its editor)
        const onKeyDown = (event: KeyboardEvent) =>
            handleUndoKeys(created, event);
        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            created.dispose();
        };
    }, [model]);
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
            {history && <History history={history} />}
        </Flow.Root>
    );
}
