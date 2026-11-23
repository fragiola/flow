import {
    createFlowModel,
    Flow,
    type FlowEdge,
    type FlowEdgeInput,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
    useFlowRef,
} from "@fragiola/flow-react";
import { connection } from "@fragiola/flow-react/connection";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import { selection } from "@fragiola/flow-react/selection";
import { MousePointer2Icon, PlusIcon } from "lucide-react";
import {
    createContext,
    type PointerEvent,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { styles } from "./styles";
import {
    type Presence,
    presenceAfter,
    receive,
    remoteSelection,
    syncModel,
} from "./sync";
import { bridgeTabs, createHub, type Hub, type Peer } from "./transport";

// Two collaborators, Alice and Bob, edit one document, each in a flow of their own. Each side's
// model is its own; `sync.ts` listens to it (`model.subscribe`) and sends what every local command
// changed over a transport (`transport.ts`: a hub in memory for this page, a `BroadcastChannel` to
// other tabs of it). The other side applies it as one `batch` of the commands `commands-to` gives,
// marked as remote so it is never sent back; the last command to arrive wins. A drag's transient
// moves are sent as they come, so the other side follows it. Where each pointer is (in flow
// coordinates, `screen-to-flow`) and what each side selects travel as presence: the other flow
// shows the collaborator's cursor with their name, and a dashed frame around the nodes they have
// selected. Open the page in another tab: it joins the same document.

interface Types extends FlowTypes {
    readonly nodes: { card: { label: string } };
}

const features = [selection(), drag(), connection(), keyboard()] as const;
type Features = typeof features;

/** The channel other tabs of this example meet on. */
const CHANNEL = "fragiola-flow-collaborative";

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "plan",
        type: "card",
        position: { x: 0, y: 0 },
        data: { label: "Plan" },
    },
    {
        id: "write",
        type: "card",
        position: { x: 200, y: 0 },
        data: { label: "Write" },
    },
    {
        id: "ship",
        type: "card",
        position: { x: 100, y: 130 },
        data: { label: "Ship" },
    },
];

const edges: FlowEdgeInput<Types>[] = [
    { id: "plan-write", source: "plan", target: "write" },
];

/** For each node another collaborator has selected, their names (`sync.ts`'s `remoteSelection`). */
const RemoteSelection = createContext<ReadonlyMap<string, readonly string[]>>(
    new Map(),
);

function CardNode({ node }: { node: FlowNode<Types> }) {
    const names = useContext(RemoteSelection).get(node.id);
    const by = names?.join(", ");
    // the first of them gives the mark its colour
    const [lead] = names ?? [];
    return (
        <Flow.Node<Types>
            node={node}
            role="group"
            aria-roledescription="node"
            aria-label={node.data.label}
            aria-description={by ? `selected by ${by}` : undefined}
            data-remote-selected={by}
            className={styles.node}
        >
            <Flow.Handle
                type="target"
                side="left"
                aria-label={`${node.data.label} input`}
                className={styles.handle}
            />
            {node.data.label}
            <Flow.Handle
                type="source"
                side="right"
                aria-label={`${node.data.label} output`}
                className={styles.handle}
            />
            {lead && (
                <span aria-hidden className={styles.mark(lead)}>
                    <span className={styles.markName}>{by}</span>
                </span>
            )}
        </Flow.Node>
    );
}

function renderNode(node: FlowNode<Types>) {
    return <CardNode node={node} />;
}

function renderEdge(edge: FlowEdge<Types>) {
    return (
        <Flow.Edge<Types>
            edge={edge}
            role="group"
            aria-roledescription="edge"
            aria-label={`${edge.source} to ${edge.target}`}
            className={styles.edgeGroup}
        >
            <Flow.EdgePath className={styles.edge} />
        </Flow.Edge>
    );
}

/** The other collaborators' pointers, in flow coordinates (inside `Flow.Viewport`). */
function Cursors({ presence }: { presence: Presence }) {
    return [...presence].map(([id, { name, at }]) =>
        at ? (
            <div
                key={id}
                data-testid="cursor"
                data-peer={name}
                className={styles.cursor(name)}
                style={{ transform: `translate(${at.x}px, ${at.y}px)` }}
            >
                <MousePointer2Icon aria-hidden />
                <span className={styles.cursorName}>{name}</span>
            </div>
        ) : null,
    );
}

/** A free id for a node `name` adds: `bob-1`, `bob-2`, … */
function newNodeId(name: string, taken: readonly { id: string }[]) {
    const ids = new Set(taken.map((entity) => entity.id));
    let n = 1;
    while (ids.has(`${name.toLowerCase()}-${n}`)) n += 1;
    return { id: `${name.toLowerCase()}-${n}`, n };
}

/** One collaborator: their own model and flow, joined to the others through `hub`. */
function Side({ name, hub }: { name: string; hub: Hub }) {
    const [model] = useState(() =>
        createFlowModel<Types, Features>(
            { version: 1, nodes, edges },
            { features },
        ),
    );
    const flow = useFlowRef<Types, Features>();
    const peer = useRef<Peer | null>(null);
    const [presence, setPresence] = useState<Presence>(() => new Map());
    const selected = useMemo(() => remoteSelection(presence), [presence]);

    // joined in an effect, so that StrictMode's second mount joins again
    useEffect(() => {
        const id = `${name.toLowerCase()}-${Math.random().toString(36).slice(2, 10)}`;
        const joined: Peer = hub.join(id, name, (message) => {
            receive(model, joined, message);
            setPresence((current) => presenceAfter(current, message));
        });
        peer.current = joined;
        const stop = syncModel(model, joined);
        return () => {
            stop();
            joined.leave();
            peer.current = null;
            setPresence(new Map());
        };
    }, [hub, model, name]);

    function onPointerMove(event: PointerEvent<HTMLDivElement>) {
        const engine = flow.current?.engine;
        if (!engine) return;
        const at = engine.get("screen-to-flow", {
            x: event.clientX,
            y: event.clientY,
        });
        peer.current?.send({ type: "cursor", at });
    }

    function addNode() {
        const { id, n } = newNodeId(name, model.get("flow-json").nodes);
        model.run("node.add", {
            id,
            type: "card",
            position: {
                x: ((n - 1) % 3) * 140,
                y: 260 + Math.floor((n - 1) / 3) * 70,
            },
            data: { label: `${name} ${n}` },
        });
    }

    return (
        <section aria-label={name} className={styles.side}>
            <RemoteSelection.Provider value={selected}>
                <Flow.Root<Types, Features>
                    model={model}
                    flowRef={flow}
                    fitView={{ padding: 0.25, maxZoom: 1 }}
                    role="group"
                    aria-label={`${name}'s flow`}
                    onPointerMove={onPointerMove}
                    onPointerLeave={() =>
                        peer.current?.send({ type: "cursor", at: null })
                    }
                    className={styles.root}
                >
                    <Flow.Background
                        variant="dots"
                        size={2}
                        className={styles.dots}
                    />
                    <Flow.Background variant="lines" className={styles.lines} />
                    <Flow.Background variant="cross" className={styles.cross} />
                    <Flow.Viewport>
                        <Flow.Edges<Types>>{renderEdge}</Flow.Edges>
                        <Flow.Nodes<Types>>{renderNode}</Flow.Nodes>
                        <Flow.ConnectionLine className={styles.connection} />
                        <Cursors presence={presence} />
                    </Flow.Viewport>
                    <div data-flow-no-gesture="" className={styles.header}>
                        <h2 className={styles.name(name)}>{name}</h2>
                        <button
                            type="button"
                            onClick={addNode}
                            className={styles.button}
                        >
                            <PlusIcon />
                            Add node
                        </button>
                    </div>
                </Flow.Root>
            </RemoteSelection.Provider>
        </section>
    );
}

export default function Collaborative() {
    const [hub] = useState(createHub);
    const [tabs, setTabs] = useState(false);
    // other tabs of this page join over a BroadcastChannel, where the browser has one
    // the page leaving (closed, reloaded, navigated away) closes it too: an unmount does not run
    // then, and the other tabs would keep this page's cursors; a page back from the back-forward
    // cache joins again
    useEffect(() => {
        let bridge = bridgeTabs(hub, CHANNEL);
        setTabs(bridge.connected);
        const onPageHide = () => bridge.close();
        const onPageShow = (event: PageTransitionEvent) => {
            if (!event.persisted) return;
            bridge = bridgeTabs(hub, CHANNEL);
        };
        window.addEventListener("pagehide", onPageHide);
        window.addEventListener("pageshow", onPageShow);
        return () => {
            window.removeEventListener("pagehide", onPageHide);
            window.removeEventListener("pageshow", onPageShow);
            bridge.close();
        };
    }, [hub]);
    return (
        <div className={styles.frame}>
            <Side name="Alice" hub={hub} />
            <Side name="Bob" hub={hub} />
            <p className={styles.hint}>
                Drag, connect, add or Delete on one side; the other follows
                {tabs ? " · open another tab to join" : ""}
            </p>
        </div>
    );
}
