import {
    type BatchEntry,
    Flow,
    type FlowEdge,
    type FlowEdgeInput,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
    useFlow,
    useKeyPress,
    useSelection,
    validateFlow,
    type XY,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import { selection } from "@fragiola/flow-react/selection";
import { ClipboardPasteIcon, CopyIcon, ScissorsIcon } from "lucide-react";
import {
    type PointerEvent,
    type RefObject,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
} from "react";
import {
    afterCopy,
    afterCut,
    type Cascade,
    cascade,
    copyOf,
    type Payload,
    parse,
    pasted,
    serialize,
    shiftFor,
} from "./clipboard";
import { styles } from "./styles";

// Copy and paste: Ctrl/⌘ + C copies the selected nodes and the edges between them, Ctrl/⌘ + X
// cuts them (`selection.remove`), Ctrl/⌘ + V pastes them with new ids in one `batch` that also
// selects them; the toolbar's buttons do the same. The keys are read with `useKeyPress` (the
// library's own shortcuts use no Ctrl/⌘ + C, X or V). A paste goes under the pointer when it is
// over the flow (`screen-to-flow`), and each paste at the same place moves one step further. The
// clipboard is JSON with a marker (`clipboard.ts`): it is written to the system clipboard when the
// browser allows it, so another tab of this example can paste it, and kept in memory as well, for
// when reading the system clipboard is refused or it holds someone else's text.

interface Types extends FlowTypes {
    readonly nodes: { step: { label: string } };
    readonly edges: { bezier: { name: string } };
}

const features = [selection(), drag(), keyboard()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "idea",
        type: "step",
        position: { x: 0, y: 0 },
        data: { label: "Idea" },
    },
    {
        id: "sketch",
        type: "step",
        position: { x: 200, y: 0 },
        data: { label: "Sketch" },
    },
    {
        id: "build",
        type: "step",
        position: { x: 400, y: 0 },
        data: { label: "Build" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    {
        id: "idea-sketch",
        source: "idea",
        target: "sketch",
        data: { name: "Idea to Sketch" },
    },
    {
        id: "sketch-build",
        source: "sketch",
        target: "build",
        data: { name: "Sketch to Build" },
    },
];

function renderNode(node: FlowNode<Types>) {
    return (
        <Flow.Node<Types>
            node={node}
            role="group"
            aria-roledescription="node"
            aria-label={node.data.label}
            className={styles.node}
        >
            <Flow.Handle type="target" side="left" className={styles.handle} />
            {node.data.label}
            <Flow.Handle type="source" side="right" className={styles.handle} />
        </Flow.Node>
    );
}

function renderEdge(edge: FlowEdge<Types>) {
    const name = edge.data?.name;
    return (
        <Flow.Edge<Types>
            edge={edge}
            role="group"
            aria-roledescription="edge"
            aria-label={
                typeof name === "string"
                    ? name
                    : `${edge.source} to ${edge.target}`
            }
            className={styles.edgeGroup}
        >
            <Flow.EdgePath className={styles.edge} />
        </Flow.Edge>
    );
}

/** "2 nodes and 1 edge". */
const counted = (payload: {
    nodes: readonly unknown[];
    edges: readonly unknown[];
}) =>
    `${payload.nodes.length} ${payload.nodes.length === 1 ? "node" : "nodes"} and ${payload.edges.length} ${payload.edges.length === 1 ? "edge" : "edges"}`;

/** Writes the system clipboard when the browser allows it; a refusal leaves the memory's copy. */
async function writeSystem(text: string) {
    try {
        await navigator.clipboard?.writeText(text);
    } catch {
        // refused (no permission, the page not focused): the in-memory copy stands
    }
}

/** The system clipboard's text, or nothing when the browser refuses to read it. */
async function readSystem(): Promise<string | undefined> {
    try {
        return await navigator.clipboard?.readText();
    } catch {
        return undefined;
    }
}

/** Whether the keys belong to a text field or a text selection rather than to the flow. */
function typing(document: Document) {
    const active = document.activeElement;
    if (
        active instanceof HTMLElement &&
        (active.isContentEditable ||
            active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA")
    )
        return true;
    const text = document.getSelection();
    return text !== null && !text.isCollapsed;
}

/** The toolbar and the shortcuts: copy, cut and paste, and what the last one did. */
function Clipboard({ pointer }: { pointer: RefObject<XY | undefined> }) {
    const { model, engine } = useFlow<Types, typeof features>();
    const selected = useSelection<Types>().nodes.length;
    const memory = useRef<Payload<Types> | undefined>(undefined);
    const place = useRef<Cascade>(afterCopy);
    const queue = useRef<Promise<void>>(Promise.resolve());
    const [message, setMessage] = useState("Select nodes, then copy them.");

    function copy(cut: boolean) {
        const ids = model.get("selected-nodes").map((node) => node.id);
        if (ids.length === 0) {
            setMessage("Select nodes to copy.");
            return;
        }
        const { nodes, edges } = model.get("flow-json");
        const payload = copyOf(nodes, edges, ids);
        memory.current = payload;
        place.current = cut ? afterCut : afterCopy;
        void writeSystem(serialize(payload));
        if (cut) model.run("selection.remove", {});
        setMessage(`${cut ? "Cut" : "Copied"} ${counted(payload)}.`);
    }

    /** Pastes once the paste before it is done, so two quick presses never share ids. */
    function paste(atPointer: boolean) {
        queue.current = queue.current.then(() => pasteNow(atPointer));
    }

    async function pasteNow(atPointer: boolean) {
        // the system clipboard first (another tab's copy), this page's own copy otherwise
        const payload = parse<Types>(await readSystem()) ?? memory.current;
        if (!payload) {
            setMessage("Nothing to paste yet.");
            return;
        }
        const client = atPointer ? pointer.current : undefined;
        const at = client ? engine.get("screen-to-flow", client) : undefined;
        const { step, next } = cascade(place.current, at);
        const flow = model.get("flow-json");
        const taken = [...flow.nodes, ...flow.edges].map((entity) => entity.id);
        const copies = pasted(payload, taken, shiftFor(payload, step, at));
        // text from outside the page: checked as a whole document before it is loaded
        const issues = validateFlow(
            { version: 1, nodes: copies.nodes, edges: copies.edges },
            { features },
        );
        if (issues.length > 0) {
            setMessage("The clipboard holds an unreadable flow.");
            return;
        }
        const commands: BatchEntry<Types>[] = [
            ...copies.nodes.map(
                (payload): BatchEntry<Types> => ({
                    command: "node.add",
                    payload,
                }),
            ),
            ...copies.edges.map(
                (payload): BatchEntry<Types> => ({
                    command: "edge.add",
                    payload,
                }),
            ),
            {
                command: "selection.set",
                payload: {
                    nodeIds: copies.nodes.map((node) => node.id),
                    mode: "replace",
                },
            },
        ];
        if (!model.run("batch", { commands }).ok) {
            setMessage("The paste was refused.");
            return;
        }
        place.current = next;
        setMessage(`Pasted ${counted(copies)}.`);
    }

    // the shortcuts: Ctrl on Windows and Linux, ⌘ on macOS; each acts once per press
    const copyKeys = useKeyPress(["Control+c", "Meta+c"]);
    const cutKeys = useKeyPress(["Control+x", "Meta+x"]);
    const pasteKeys = useKeyPress(["Control+v", "Meta+v"]);
    const onKeys = useEffectEvent((action: "copy" | "cut" | "paste") => {
        if (typing(globalThis.document)) return;
        if (action === "paste") paste(true);
        else copy(action === "cut");
    });
    useEffect(() => {
        if (copyKeys) onKeys("copy");
    }, [copyKeys]);
    useEffect(() => {
        if (cutKeys) onKeys("cut");
    }, [cutKeys]);
    useEffect(() => {
        if (pasteKeys) onKeys("paste");
    }, [pasteKeys]);

    return (
        <div
            role="toolbar"
            aria-label="Clipboard"
            data-flow-no-gesture=""
            className={styles.panel}
        >
            <button
                type="button"
                disabled={selected === 0}
                onClick={() => copy(false)}
                className={styles.button}
            >
                <CopyIcon />
                Copy
            </button>
            <button
                type="button"
                disabled={selected === 0}
                onClick={() => copy(true)}
                className={styles.button}
            >
                <ScissorsIcon />
                Cut
            </button>
            <button
                type="button"
                onClick={() => paste(false)}
                className={styles.button}
            >
                <ClipboardPasteIcon />
                Paste
            </button>
            <p role="status" data-testid="message" className={styles.message}>
                {message}
            </p>
        </div>
    );
}

export default function CopyPaste() {
    // where the pointer is over the flow (client coordinates), for a paste under it
    const pointer = useRef<XY | undefined>(undefined);

    function onPointerMove(event: PointerEvent<HTMLDivElement>) {
        const overToolbar =
            event.target instanceof Element &&
            event.target.closest('[role="toolbar"]') !== null;
        pointer.current = overToolbar
            ? undefined
            : { x: event.clientX, y: event.clientY };
    }

    return (
        <Flow.Root<Types, typeof features>
            features={features}
            defaultNodes={nodes}
            defaultEdges={edges}
            fitView={{ padding: 0.3, maxZoom: 1 }}
            role="group"
            aria-label="Copy and paste"
            onPointerMove={onPointerMove}
            onPointerLeave={() => {
                pointer.current = undefined;
            }}
            className={styles.root}
        >
            <Flow.Background variant="dots" size={2} className={styles.dots} />
            <Flow.Background variant="lines" className={styles.lines} />
            <Flow.Background variant="cross" className={styles.cross} />
            <Flow.Viewport>
                <Flow.Edges<Types>>{renderEdge}</Flow.Edges>
                <Flow.Nodes<Types>>{renderNode}</Flow.Nodes>
            </Flow.Viewport>
            <Clipboard pointer={pointer} />
            <p className={styles.hint}>
                Click or Shift-click nodes · Ctrl/⌘ + C, X, V · a paste goes
                under the pointer
            </p>
        </Flow.Root>
    );
}
