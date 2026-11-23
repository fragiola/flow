import {
    Flow,
    type FlowEdge,
    type FlowEdgeInput,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
    useFlowRef,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { selection } from "@fragiola/flow-react/selection";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
    DIRECTIONS,
    type Direction,
    HANDLE_SIDES,
    layoutPositions,
    type Point,
} from "./layout";
import { styles } from "./styles";
import { tween } from "./tween";

// A tree laid out by dagre (`layout.ts`): the nodes declare their size, dagre ranks them from the
// root and places them, and the flow opens laid out (the positions are computed before the first
// render) and fitted to the view. "Direction" lays it out again top to bottom or left to right:
// each node's handles move to the sides the tree now grows by (remounted per direction, `key`, as
// the engine reads a handle's side when it registers), and the nodes glide to their new places:
// one transient `batch` of `node.move` per animation frame, eased (`tween.ts`), then one batch
// that is not transient with the exact places (one step for a history or a save), then
// `fit-view` animated. The root carries `data-direction`, and `data-animating` while the nodes move.

interface Types extends FlowTypes {
    readonly nodes: { step: { label: string } };
}

const features = [selection(), drag()] as const;

/** Every node's declared box, in flow units: what dagre lays out. */
const WIDTH = 150;
const HEIGHT = 44;

/** How long the nodes take to reach their new places, in milliseconds. */
const DURATION = 350;

/** How the view fits the tree: some room around it, never zoomed in past 1. */
const FIT = { padding: 0.15, maxZoom: 1 };

/** The tree: a product study, from the idea to the launch (Findings and Roadmap join two branches). */
const STEPS: readonly (readonly [id: string, label: string])[] = [
    ["idea", "Idea"],
    ["research", "Research"],
    ["design", "Design"],
    ["interviews", "Interviews"],
    ["survey", "Survey"],
    ["sketches", "Sketches"],
    ["prototype", "Prototype"],
    ["findings", "Findings"],
    ["usability", "Usability test"],
    ["roadmap", "Roadmap"],
    ["launch", "Launch"],
];

const LINKS: readonly (readonly [source: string, target: string])[] = [
    ["idea", "research"],
    ["idea", "design"],
    ["research", "interviews"],
    ["research", "survey"],
    ["design", "sketches"],
    ["design", "prototype"],
    ["interviews", "findings"],
    ["survey", "findings"],
    ["prototype", "usability"],
    ["findings", "roadmap"],
    ["usability", "roadmap"],
    ["roadmap", "launch"],
];

const LABELS: Record<string, string> = Object.fromEntries(STEPS);

const labelOf = (id: string) => LABELS[id] ?? id;

const edges: FlowEdgeInput<Types>[] = LINKS.map(([source, target]) => ({
    id: `${source}-${target}`,
    source,
    target,
}));

/** What the layout reads of a node: its id and declared size. */
const boxOf = (node: { id: string; width?: number; height?: number }) => ({
    id: node.id,
    width: node.width ?? WIDTH,
    height: node.height ?? HEIGHT,
});

const FIRST: Direction = "vertical";

// laid out before the first render: the flow opens arranged, with nothing to animate
const firstPlaces = layoutPositions(
    STEPS.map(([id]) => ({ id, width: WIDTH, height: HEIGHT })),
    edges,
    FIRST,
);

const nodes: FlowNodeInput<Types>[] = STEPS.map(([id, label]) => ({
    id,
    type: "step",
    position: firstPlaces.get(id) ?? { x: 0, y: 0 },
    width: WIDTH,
    height: HEIGHT,
    data: { label },
}));

const DIRECTION_NAMES: Record<Direction, string> = {
    vertical: "Vertical",
    horizontal: "Horizontal",
};

/** Calls `step` with the progress (0 to 1) on every animation frame for `duration` ms; returns a stop. */
function everyFrame(duration: number, step: (t: number) => void): () => void {
    const start = performance.now();
    let id = requestAnimationFrame(function onFrame(now) {
        const t = Math.min(1, (now - start) / duration);
        step(t);
        if (t < 1) id = requestAnimationFrame(onFrame);
    });
    return () => cancelAnimationFrame(id);
}

/** One `node.move` per node, for a `batch`. */
const movesTo = (positions: ReadonlyMap<string, Point>) =>
    [...positions].map(([nodeId, position]) => ({
        command: "node.move" as const,
        payload: { nodeId, position },
    }));

/** The direction the tree is laid out in, for the nodes' handles. */
const DirectionContext = createContext<Direction>(FIRST);

/** A node's handles, on the sides the direction gives; remounted when it changes. */
function Handles() {
    const direction = useContext(DirectionContext);
    const sides = HANDLE_SIDES[direction];
    return (
        <>
            <Flow.Handle
                key={`target-${direction}`}
                type="target"
                side={sides.target}
                className={styles.handle}
            />
            <Flow.Handle
                key={`source-${direction}`}
                type="source"
                side={sides.source}
                className={styles.handle}
            />
        </>
    );
}

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
            <Handles />
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

export default function DagreLayout() {
    const flow = useFlowRef<Types, typeof features>();
    const [direction, setDirection] = useState<Direction>(FIRST);
    const [animating, setAnimating] = useState(false);
    // the running animation's stop, so a new direction (or leaving) ends it
    const stop = useRef<(() => void) | undefined>(undefined);
    useEffect(() => () => stop.current?.(), []);

    function arrange(next: Direction) {
        const current = flow.current;
        if (!current || next === direction) return;
        const { model, engine } = current;
        stop.current?.();
        setDirection(next);
        const all = model.get("all-nodes");
        // from where the nodes are now: mid-animation, or after a drag
        const from = new Map(all.map((node) => [node.id, node.position]));
        const to = layoutPositions(
            all.map(boxOf),
            model.get("all-edges"),
            next,
        );
        setAnimating(true);
        stop.current = everyFrame(DURATION, (t) => {
            if (t < 1) {
                // a step of the animation: transient, as a drag's steps are
                model.run(
                    "batch",
                    { commands: movesTo(tween(from, to, t)) },
                    { transient: true },
                );
                return;
            }
            // the exact places, once: the one change a history or a save keeps
            model.run("batch", { commands: movesTo(to) });
            stop.current = undefined;
            setAnimating(false);
            engine.run("fit-view", { ...FIT, duration: 300 });
        });
    }

    return (
        <DirectionContext.Provider value={direction}>
            <Flow.Root<Types, typeof features>
                features={features}
                defaultNodes={nodes}
                defaultEdges={edges}
                fitView={FIT}
                flowRef={flow}
                role="group"
                aria-label="Dagre layout"
                data-direction={direction}
                data-animating={animating ? "" : undefined}
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
                <fieldset className={styles.panel}>
                    <legend className={styles.legend}>Direction</legend>
                    {DIRECTIONS.map((option) => (
                        <label key={option} className={styles.option}>
                            <input
                                type="radio"
                                name="dagre-direction"
                                value={option}
                                checked={direction === option}
                                onChange={() => arrange(option)}
                                className={styles.radio}
                            />
                            {DIRECTION_NAMES[option]}
                        </label>
                    ))}
                </fieldset>
            </Flow.Root>
        </DirectionContext.Provider>
    );
}
