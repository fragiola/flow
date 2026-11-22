import {
    Flow,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
    useFlow,
    useSelection,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { selection } from "@fragiola/flow-react/selection";
import { CopyIcon, Trash2Icon } from "lucide-react";
import { styles } from "./styles";

// `Flow.NodeToolbar` stands next to its node, outside the zoom: it keeps its size whatever the
// zoom, and shows while its node is selected (or as `open` says). Its buttons run commands:
// duplicate (`node.add` with a new id), recolour (`node.set-data`) and delete (`node.remove`).
// With `nodeIds` it stands beside several nodes' bounds: Shift-click a second note, and the
// selection's toolbar below them recolours (one `batch`) or deletes (`selection.remove`) them all.

const TONES = ["blue", "green", "orange", "purple"] as const;
type Tone = (typeof TONES)[number];

interface Types extends FlowTypes {
    readonly nodes: { sticky: { text: string; tone: Tone } };
}

const features = [selection(), drag()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "idea",
        type: "sticky",
        position: { x: 0, y: 0 },
        selected: true,
        data: { text: "Select a note", tone: "blue" },
    },
    {
        id: "todo",
        type: "sticky",
        position: { x: 220, y: 60 },
        data: { text: "Then use its toolbar", tone: "orange" },
    },
];

let copies = 0;

function Toolbar({ node }: { node: FlowNode<Types> }) {
    const { model } = useFlow<Types, typeof features>();
    const duplicate = () => {
        copies += 1;
        model.run("node.add", {
            id: `${node.id}-copy-${copies}`,
            type: "sticky",
            position: { x: node.position.x + 30, y: node.position.y + 30 },
            data: node.data,
        });
    };
    return (
        <Flow.NodeToolbar
            role="toolbar"
            aria-label={`${node.data.text}: actions`}
            className={styles.toolbar}
        >
            <button
                type="button"
                aria-label="Duplicate"
                onClick={duplicate}
                className={styles.action}
            >
                <CopyIcon />
            </button>
            {TONES.map((tone) => (
                <button
                    key={tone}
                    type="button"
                    aria-label={`Make it ${tone}`}
                    aria-pressed={node.data.tone === tone}
                    onClick={() =>
                        model.run("node.set-data", {
                            nodeId: node.id,
                            data: { tone },
                        })
                    }
                    className={styles.tone(tone)}
                />
            ))}
            <button
                type="button"
                aria-label="Delete"
                onClick={() => model.run("node.remove", { nodeId: node.id })}
                className={styles.delete}
            >
                <Trash2Icon />
            </button>
        </Flow.NodeToolbar>
    );
}

/** The selection's toolbar, below the selected notes while there are two or more. */
function SelectionToolbar() {
    const { model } = useFlow<Types, typeof features>();
    const selected = useSelection<Types>();
    if (selected.nodes.length < 2) return null;
    const nodeIds = selected.nodes.map((node) => node.id);
    return (
        <Flow.NodeToolbar
            nodeIds={nodeIds}
            side="bottom"
            role="toolbar"
            aria-label={`${nodeIds.length} notes: actions`}
            className={styles.toolbar}
        >
            {TONES.map((tone) => (
                <button
                    key={tone}
                    type="button"
                    aria-label={`Make them ${tone}`}
                    onClick={() =>
                        model.run("batch", {
                            commands: nodeIds.map((nodeId) => ({
                                command: "node.set-data" as const,
                                payload: { nodeId, data: { tone } },
                            })),
                        })
                    }
                    className={styles.tone(tone)}
                />
            ))}
            <button
                type="button"
                aria-label="Delete them"
                onClick={() => model.run("selection.remove", {})}
                className={styles.delete}
            >
                <Trash2Icon />
            </button>
        </Flow.NodeToolbar>
    );
}

function renderNode(node: FlowNode<Types>) {
    return (
        <Flow.Node<Types> node={node} className={styles.sticky(node.data.tone)}>
            {node.data.text}
            <Toolbar node={node} />
        </Flow.Node>
    );
}

export default function NodeToolbarExample() {
    return (
        <Flow.Root<Types, typeof features>
            features={features}
            defaultNodes={nodes}
            fitView={{ padding: 0.2, maxZoom: 1 }}
            className={styles.root}
        >
            <Flow.Background variant="dots" size={2} className={styles.dots} />
            <Flow.Background variant="lines" className={styles.lines} />
            <Flow.Background variant="cross" className={styles.cross} />
            <Flow.Viewport>
                <Flow.Nodes<Types>>{renderNode}</Flow.Nodes>
            </Flow.Viewport>
            <SelectionToolbar />
        </Flow.Root>
    );
}
