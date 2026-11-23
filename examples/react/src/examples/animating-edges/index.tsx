import {
    Flow,
    type FlowEdge,
    type FlowEdgeInput,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
    useEdge,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { keyboard } from "@fragiola/flow-react/keyboard";
import { selection } from "@fragiola/flow-react/selection";
import { SendIcon } from "lucide-react";
import {
    type AnimationEvent,
    createContext,
    useContext,
    useMemo,
    useState,
    useSyncExternalStore,
} from "react";
import {
    DASH_PERIOD,
    describeMotion,
    type Motion,
    onReducedMotionChange,
    prefersReducedMotion,
    travelSeconds,
} from "./motion";
import { styles } from "./styles";

// The package animates nothing: an edge moves by what the app puts in it. A dot travels along the
// first edge (an SVG `<animateMotion>` whose `path` is the edge's own, `useEdge(edge).state.path`,
// so it follows the edge while a node is dragged), dashes flow along the second (an `<animate>` of
// the path's `stroke-dashoffset`), and the third pulses once when a value passes: "Send a value"
// marks it `data-pulsing`, its style runs one pulse, and `animationend` clears the mark and hands
// the value over. Under `prefers-reduced-motion` (read with `matchMedia`, followed live) neither
// the dot nor the dashes move, and those edges say so (`data-reduced-motion`).

interface Types extends FlowTypes {
    readonly nodes: {
        step: { label: string };
        sender: { label: string };
        counter: { label: string };
    };
    readonly edges: { animated: { motion: Motion } };
}

const features = [selection(), drag(), keyboard()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "ingest",
        type: "step",
        position: { x: 0, y: 0 },
        data: { label: "Ingest" },
    },
    {
        id: "process",
        type: "step",
        position: { x: 300, y: 0 },
        data: { label: "Process" },
    },
    {
        id: "store",
        type: "step",
        position: { x: 600, y: 0 },
        data: { label: "Store" },
    },
    {
        id: "sender",
        type: "sender",
        position: { x: 120, y: 200 },
        data: { label: "Sender" },
    },
    {
        id: "counter",
        type: "counter",
        position: { x: 480, y: 200 },
        data: { label: "Counter" },
    },
];

const animated = (source: string, target: string, motion: Motion) => ({
    id: `${source}-${target}`,
    source,
    target,
    type: "animated" as const,
    data: { motion },
});

const edges: FlowEdgeInput<Types>[] = [
    animated("ingest", "process", "travel"),
    animated("process", "store", "dash"),
    animated("sender", "counter", "pulse"),
];

const LABELS: Record<string, string> = Object.fromEntries(
    nodes.map((node) => [node.id, node.data.label]),
);

/** Whether the user asked for reduced motion, followed live; a server render assumes not. */
function useReducedMotion(): boolean {
    return useSyncExternalStore(
        onReducedMotionChange,
        prefersReducedMotion,
        () => false,
    );
}

/** The values passing from the sender to the counter: app state, outside the flow's document. */
interface Values {
    /** a value is on its way: the pulse is running */
    readonly sending: boolean;
    /** how many values the counter has received */
    readonly received: number;
    readonly send: () => void;
    /** the pulse ended: the value arrives */
    readonly arrive: () => void;
}

const ValuesContext = createContext<Values>({
    sending: false,
    received: 0,
    send: () => {},
    arrive: () => {},
});

const ReducedMotion = createContext(false);

function AnimatedEdge({ edge }: { edge: FlowEdge<Types> }) {
    const { state } = useEdge<Types>(edge);
    const reduced = useContext(ReducedMotion);
    const { sending, arrive } = useContext(ValuesContext);
    const motion =
        edge.type === "animated" && edge.data ? edge.data.motion : "dash";
    const path = state.path;
    const moving = motion !== "pulse" && !reduced;
    const pulsing = motion === "pulse" && sending;
    const onAnimationEnd = (event: AnimationEvent<SVGGElement>) => {
        // only the group's own pulse, not an animation inside it
        if (event.target === event.currentTarget && pulsing) arrive();
    };
    return (
        <Flow.Edge<Types>
            edge={edge}
            role="group"
            aria-roledescription="edge"
            aria-label={`${LABELS[edge.source]} to ${LABELS[edge.target]}: ${describeMotion(motion, reduced)}`}
            data-reduced-motion={motion !== "pulse" && reduced ? "" : undefined}
            data-pulsing={pulsing ? "" : undefined}
            onAnimationEnd={onAnimationEnd}
            className={styles.edgeGroup}
        >
            {/* a wide transparent path: a bigger target for a click */}
            <Flow.EdgePath className={styles.edgeHit} />
            <Flow.EdgePath className={styles.edge(motion)}>
                {motion === "dash" && moving && (
                    <animate
                        attributeName="stroke-dashoffset"
                        from={DASH_PERIOD}
                        to={0}
                        dur="0.8s"
                        repeatCount="indefinite"
                    />
                )}
            </Flow.EdgePath>
            {motion === "travel" && moving && path && (
                <circle
                    r={6}
                    data-testid="traveller"
                    className={styles.traveller}
                >
                    <animateMotion
                        path={path.path}
                        dur={`${travelSeconds(path.source, path.target)}s`}
                        repeatCount="indefinite"
                    />
                </circle>
            )}
        </Flow.Edge>
    );
}

function renderEdge(edge: FlowEdge<Types>) {
    return <AnimatedEdge edge={edge} />;
}

function SenderBody({ label }: { label: string }) {
    const { sending, send } = useContext(ValuesContext);
    return (
        <div className={styles.body}>
            {label}
            <button
                type="button"
                aria-label="Send a value"
                disabled={sending}
                onClick={send}
                className={styles.send}
            >
                <SendIcon aria-hidden="true" />
                Send
            </button>
        </div>
    );
}

function CounterBody({ label }: { label: string }) {
    const { received } = useContext(ValuesContext);
    return (
        <div className={styles.body}>
            {label}
            <output
                aria-live="polite"
                aria-label="Values received"
                data-testid="received"
                className={styles.received}
            >
                {received}
            </output>
        </div>
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
            {node.type === "sender" && <SenderBody label={label} />}
            {node.type === "counter" && <CounterBody label={label} />}
            {node.type === "step" && label}
            <Flow.Handle type="source" side="right" className={styles.handle} />
        </Flow.Node>
    );
}

export default function AnimatingEdges() {
    const reduced = useReducedMotion();
    const [sending, setSending] = useState(false);
    const [received, setReceived] = useState(0);
    const values = useMemo<Values>(
        () => ({
            sending,
            received,
            send: () => setSending(true),
            arrive: () => {
                setSending(false);
                setReceived((count) => count + 1);
            },
        }),
        [sending, received],
    );
    return (
        <ReducedMotion.Provider value={reduced}>
            <ValuesContext.Provider value={values}>
                <Flow.Root<Types, typeof features>
                    features={features}
                    defaultNodes={nodes}
                    defaultEdges={edges}
                    fitView={{ padding: 0.15, maxZoom: 1 }}
                    role="group"
                    aria-label="Animating edges"
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
                    </Flow.Viewport>
                </Flow.Root>
            </ValuesContext.Provider>
        </ReducedMotion.Provider>
    );
}
