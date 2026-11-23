import {
    Flow,
    type FlowEdge,
    type FlowNode,
    type FlowTypes,
    useFlowRef,
    useFlowStore,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { selection } from "@fragiola/flow-react/selection";
import { ShuffleIcon } from "lucide-react";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { formatMs, frameMeter } from "./frames";
import { generateFlow, labelOf, SIZES, type Size, shuffle } from "./generate";
import { styles } from "./styles";

// A flow of thousands of nodes and as many edges, generated (generate.ts: a seeded grid joined into
// one tree, the same every time), 1,000 by default and up to 20,000. `onlyRenderVisible` keeps in
// the DOM only the nodes and edges in view, so the DOM stays small whatever the size; the readout
// shows what each gesture costs. The nodes declare their size and handles, so a node never drawn
// still has a box (it is culled rightly) and its edges have ends. The layers wait for the engine
// to be `ready` (the root sized, so the view known): before that, `visible-nodes` is every node
// and a first render would mount them all. "Shuffle" moves every node in one `batch`: one change,
// one render. The readout counts the nodes and edges in the DOM and times the frames
// (requestAnimationFrame, the median of the last 60, frames.ts), the last size switch and the
// last shuffle (until the next frame).

interface Types extends FlowTypes {
    readonly nodes: { cell: { label: string } };
}

const features = [selection(), drag()] as const;

/** How the size picker names a size: "10,000 nodes". */
const sizeName = (size: number) => `${size.toLocaleString("en-US")} nodes`;

/** A cheap node: one element and its label, its place on it for the tests. */
function renderNode(node: FlowNode<Types>) {
    return (
        <Flow.Node<Types>
            node={node}
            role="group"
            aria-roledescription="node"
            aria-label={node.data.label}
            data-position={`${Math.round(node.position.x)}, ${Math.round(node.position.y)}`}
            className={styles.node}
        >
            {node.data.label}
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

/**
 * The edges and the nodes, once the engine knows the view (`ready`: the root has a size, and the
 * nodes declare theirs): until then every node counts as visible, and all of them would mount.
 */
function Layers() {
    const ready = useFlowStore<boolean, Types, typeof features>(({ engine }) =>
        engine.is("ready"),
    );
    if (!ready) return null;
    return (
        <>
            <Flow.Edges<Types>>{renderEdge}</Flow.Edges>
            <Flow.Nodes<Types>>{renderNode}</Flow.Nodes>
        </>
    );
}

interface Counts {
    readonly nodes: number;
    readonly edges: number;
    readonly frameMs: number | undefined;
}

/** The nodes and edges in the DOM and the frame time, read a few times a second. */
function useLiveCounts(frame: RefObject<HTMLElement | null>): Counts {
    const [counts, setCounts] = useState<Counts>({
        nodes: 0,
        edges: 0,
        frameMs: undefined,
    });
    useEffect(() => {
        const meter = frameMeter(60);
        let ticks = 0;
        let id = requestAnimationFrame(function onFrame(time) {
            meter.tick(time);
            ticks += 1;
            // every 15th frame: a readout updated each frame would cost frames itself
            if (ticks % 15 === 0 && frame.current) {
                const root = frame.current;
                setCounts({
                    nodes: root.querySelectorAll('[data-flow-part="node"]')
                        .length,
                    edges: root.querySelectorAll('[data-flow-part="edge"]')
                        .length,
                    frameMs: meter.median(),
                });
            }
            id = requestAnimationFrame(onFrame);
        });
        // a hidden tab gets no frames: the gap after it is not a frame
        const onVisibility = () => meter.reset();
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            cancelAnimationFrame(id);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [frame]);
    return counts;
}

/** Calls `done` with the time since `start` once the next frame begins (the change is drawn). */
function timeToFrame(start: number, done: (ms: number) => void) {
    requestAnimationFrame(() => done(performance.now() - start));
}

export default function StressTest() {
    const [size, setSize] = useState<Size>(SIZES[0]);
    const flowData = useMemo(() => generateFlow(size), [size]);
    const flow = useFlowRef<Types, typeof features>();
    const frame = useRef<HTMLDivElement>(null);
    const counts = useLiveCounts(frame);
    // when the shown size was asked for: the first render, then each switch
    const [switchedAt, setSwitchedAt] = useState(() => performance.now());
    const [renderMs, setRenderMs] = useState<number>();
    const [shuffleMs, setShuffleMs] = useState<number>();
    const shuffles = useRef(0);

    function onSize(value: string) {
        const next = SIZES.find((option) => String(option) === value);
        if (next === undefined || next === size) return;
        setSwitchedAt(performance.now());
        setRenderMs(undefined);
        setShuffleMs(undefined);
        setSize(next);
    }

    function onShuffle() {
        const model = flow.current?.model;
        if (!model) return;
        shuffles.current += 1;
        const start = performance.now();
        const moves = shuffle(model.get("all-nodes"), shuffles.current + 1);
        // every move in one batch: one change of the document, one render
        model.run("batch", {
            commands: moves.map((payload) => ({
                command: "node.move" as const,
                payload,
            })),
        });
        timeToFrame(start, setShuffleMs);
    }

    return (
        <div ref={frame} className={styles.frame}>
            <Flow.Root<Types, typeof features>
                // a new size is a new flow
                key={size}
                features={features}
                defaultNodes={flowData.nodes}
                defaultEdges={flowData.edges}
                defaultViewport={{ x: 48, y: 120, zoom: 1 }}
                minZoom={0.1}
                onlyRenderVisible
                flowRef={flow}
                onInit={() => timeToFrame(switchedAt, setRenderMs)}
                role="group"
                aria-label="Stress test"
                aria-busy={renderMs === undefined}
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
                    <Layers />
                </Flow.Viewport>
            </Flow.Root>
            <div className={styles.panel}>
                <label className={styles.field}>
                    <span>Size</span>
                    <select
                        value={size}
                        onChange={(event) => onSize(event.target.value)}
                        className={styles.select}
                    >
                        {SIZES.map((option) => (
                            <option key={option} value={option}>
                                {sizeName(option)}
                            </option>
                        ))}
                    </select>
                </label>
                <button
                    type="button"
                    onClick={onShuffle}
                    className={styles.button}
                >
                    <ShuffleIcon />
                    Shuffle
                </button>
                <dl
                    aria-label="Readout"
                    data-testid="readout"
                    data-size={size}
                    data-edges={flowData.edges.length}
                    data-dom-nodes={counts.nodes}
                    data-dom-edges={counts.edges}
                    data-frame-ms={formatMs(counts.frameMs)}
                    data-render-ms={formatMs(renderMs)}
                    data-shuffle-ms={formatMs(shuffleMs)}
                    className={styles.readout}
                >
                    <div className={styles.stat}>
                        <dt>In the DOM</dt>
                        <dd className={styles.value}>
                            {counts.nodes} nodes, {counts.edges} edges
                        </dd>
                    </div>
                    <div className={styles.stat}>
                        <dt>Frame</dt>
                        <dd className={styles.value}>
                            {formatMs(counts.frameMs)} ms
                        </dd>
                    </div>
                    <div className={styles.stat}>
                        <dt>Rendered in</dt>
                        <dd className={styles.value}>
                            {formatMs(renderMs)} ms
                        </dd>
                    </div>
                    <div className={styles.stat}>
                        <dt>Shuffled in</dt>
                        <dd className={styles.value}>
                            {formatMs(shuffleMs)} ms
                        </dd>
                    </div>
                </dl>
            </div>
        </div>
    );
}
