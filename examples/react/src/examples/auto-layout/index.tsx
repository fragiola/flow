import {
    Flow,
    type FlowEdge,
    type FlowEdgeInput,
    type FlowNode,
    type FlowNodeInput,
    type FlowTypes,
    useFlowRef,
    useFlowStore,
} from "@fragiola/flow-react";
import { drag } from "@fragiola/flow-react/drag";
import { selection } from "@fragiola/flow-react/selection";
import { ChevronDownIcon, ChevronUpIcon, PlusIcon } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { layoutPositions, type Point } from "./layout";
import { styles } from "./styles";
import {
    addChildCommands,
    childrenOf,
    isPlaceholder,
    type PlaceholderData,
    placeholderEdge,
    placeholderNode,
    type TopicData,
    toggleCommands,
    topicData,
    topicEdge,
    topicNode,
} from "./tree";
import { tween } from "./tween";

// A mind map that lays itself out again after every change (dagre, top to bottom, `layout.ts`).
// Under each shown topic sits a "+" placeholder, a node of its own (`add-<topic>`) with a dashed
// edge, laid out like the rest: pressing it adds a child in one `batch` (the topic, its edge, its
// own placeholder and that edge, `tree.ts`), starting at its parent's place. A topic with
// children has a toggle that collapses its subtree: one `batch` writes `collapsed` in its data
// (`node.set-data`) and hides every descendant, their placeholders, its own, and the edges into
// them (`node.set-flags` / `edge.set-flags { hidden }`); expanding shows them again, except under
// a topic still collapsed. The layout runs on the shown nodes only, and they glide to their new
// places: one transient `batch` of `node.move` per animation frame (`tween.ts`), then one batch
// that is not transient with the exact places, then `fit-view` animated. The root carries
// `data-animating` while the nodes move and `data-layouts`, the number of layouts finished (for a
// test to wait on the one a press starts); a collapsed topic carries `data-collapsed`.

interface Types extends FlowTypes {
    readonly nodes: { topic: TopicData; add: PlaceholderData };
}

const features = [selection(), drag()] as const;

/** How long the nodes take to reach their new places, in milliseconds. */
const DURATION = 350;

/** How the view fits the tree: some room around it, never zoomed in past 1. */
const FIT = { padding: 0.15, maxZoom: 1 };

/** The map: a product launch, its teams and their first tasks. */
const TOPICS: readonly (readonly [
    id: string,
    label: string,
    parent?: string,
])[] = [
    ["launch", "Product launch"],
    ["marketing", "Marketing", "launch"],
    ["engineering", "Engineering", "launch"],
    ["support", "Support", "launch"],
    ["campaign", "Campaign", "marketing"],
    ["press", "Press kit", "marketing"],
    ["backend", "Backend", "engineering"],
    ["frontend", "Frontend", "engineering"],
    ["docs", "Help center", "support"],
];

const ORIGIN = { x: 0, y: 0 };

const firstNodes = TOPICS.flatMap(([id, label]) => [
    topicNode(id, label, ORIGIN),
    placeholderNode(id, label, ORIGIN),
]);

const edges: FlowEdgeInput<Types>[] = TOPICS.flatMap(([id, , parent]) => [
    ...(parent ? [topicEdge(parent, id)] : []),
    placeholderEdge(id),
]);

/** What the layout reads of a node: its id, declared size and whether it shows. */
const boxOf = (node: {
    id: string;
    width?: number;
    height?: number;
    hidden?: boolean;
}) => ({
    id: node.id,
    width: node.width ?? 0,
    height: node.height ?? 0,
    hidden: node.hidden,
});

// laid out before the first render: the map opens arranged, with nothing to animate
const firstPlaces = layoutPositions(firstNodes.map(boxOf), edges);

const nodes: FlowNodeInput<Types>[] = firstNodes.map((node) => ({
    ...node,
    position: firstPlaces.get(node.id) ?? ORIGIN,
}));

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

/** What the nodes' buttons do: add a child under a topic, collapse or expand a topic. */
interface Actions {
    readonly add: (parentId: string) => void;
    readonly toggle: (topicId: string) => void;
}

const ActionsContext = createContext<Actions>({
    add: () => {},
    toggle: () => {},
});

/** The collapse toggle of a topic with children (none on a leaf). */
function Toggle({ node }: { node: FlowNode<Types> }) {
    const { toggle } = useContext(ActionsContext);
    const parent = useFlowStore<boolean, Types, typeof features>(
        ({ model }) => childrenOf(model.get("all-edges"), node.id).length > 0,
    );
    if (!parent) return null;
    const { label, collapsed = false } = topicData(node);
    const Icon = collapsed ? ChevronDownIcon : ChevronUpIcon;
    return (
        <button
            type="button"
            aria-expanded={!collapsed}
            aria-label={`${collapsed ? "Expand" : "Collapse"} ${label}`}
            onClick={() => toggle(node.id)}
            className={styles.toggle}
        >
            <Icon aria-hidden="true" className={styles.icon} />
        </button>
    );
}

/** The "+" under a topic: adds a child to it. */
function AddButton({ data }: { data: PlaceholderData }) {
    const { add } = useContext(ActionsContext);
    return (
        <button
            type="button"
            aria-label={`Add a child to ${data.parentLabel}`}
            onClick={() => add(data.parentId)}
            className={styles.add}
        >
            <PlusIcon aria-hidden="true" className={styles.icon} />
        </button>
    );
}

function renderNode(node: FlowNode<Types>) {
    if (node.type === "add") {
        return (
            <Flow.Node<Types> node={node} className={styles.placeholder}>
                <Flow.Handle
                    type="target"
                    side="top"
                    className={styles.placeholderHandle}
                />
                <AddButton data={node.data as PlaceholderData} />
            </Flow.Node>
        );
    }
    const { label, collapsed } = topicData(node);
    return (
        <Flow.Node<Types>
            node={node}
            role="group"
            aria-roledescription="node"
            aria-label={label}
            data-position={`${Math.round(node.position.x)}, ${Math.round(node.position.y)}`}
            data-collapsed={collapsed ? "" : undefined}
            className={styles.node}
        >
            <Flow.Handle type="target" side="top" className={styles.handle} />
            <span className={styles.label}>{label}</span>
            <Toggle node={node} />
            <Flow.Handle
                type="source"
                side="bottom"
                className={styles.handle}
            />
        </Flow.Node>
    );
}

/** A topic's label, read from the document (an added topic's too); none for a placeholder. */
function useLabel(id: string): string {
    return useFlowStore<string, Types, typeof features>(({ model }) => {
        const node = model.get("node-by", { id });
        return node && !isPlaceholder(id) ? topicData(node).label : id;
    });
}

/** An edge, named by its topics: "Marketing to Campaign", or "Marketing to its add button". */
function TreeEdge({ edge }: { edge: FlowEdge<Types> }) {
    const source = useLabel(edge.source);
    const target = useLabel(edge.target);
    const placeholder = isPlaceholder(edge.target);
    return (
        <Flow.Edge<Types>
            edge={edge}
            role="group"
            aria-roledescription="edge"
            aria-label={
                placeholder
                    ? `${source} to its add button`
                    : `${source} to ${target}`
            }
            className={styles.edgeGroup}
        >
            <Flow.EdgePath
                className={placeholder ? styles.placeholderEdge : styles.edge}
            />
        </Flow.Edge>
    );
}

function renderEdge(edge: FlowEdge<Types>) {
    return <TreeEdge edge={edge} />;
}

export default function AutoLayout() {
    const flow = useFlowRef<Types, typeof features>();
    const [animating, setAnimating] = useState(false);
    const [layouts, setLayouts] = useState(0);
    // the running animation's stop, so a new change (or leaving) ends it
    const stop = useRef<(() => void) | undefined>(undefined);
    useEffect(() => () => stop.current?.(), []);
    // the next added topic's number: `topic-1` "Topic 1", `topic-2` "Topic 2", …
    const counter = useRef(1);

    /** Lays the shown nodes out again and glides them there from where they are. */
    function relayout() {
        const current = flow.current;
        if (!current) return;
        const { model, engine } = current;
        stop.current?.();
        const all = model.get("all-nodes");
        // from where the nodes are now: mid-animation, or after a drag
        const from = new Map(all.map((node) => [node.id, node.position]));
        const to = layoutPositions(all.map(boxOf), model.get("all-edges"));
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
            setLayouts((count) => count + 1);
            engine.run("fit-view", { ...FIT, duration: 300 });
        });
    }

    const [actions] = useState<Actions>(() => ({
        add(parentId) {
            const model = flow.current?.model;
            const parent = model?.get("node-by", { id: parentId });
            if (!model || !parent) return;
            const number = counter.current++;
            const id = `topic-${number}`;
            const label = `Topic ${number}`;
            // the topic, its edge, its placeholder and that edge: one change
            model.run("batch", {
                commands: addChildCommands(parent, id, label),
            });
            relayout();
        },
        toggle(topicId) {
            const model = flow.current?.model;
            const topic = model?.get("node-by", { id: topicId });
            if (!model || !topic) return;
            const all = model.get("all-nodes");
            const collapsed = topicData(topic).collapsed !== true;
            const commands = toggleCommands(
                all,
                model.get("all-edges"),
                topicId,
                collapsed,
            );
            // the nodes an expand shows again start at their topic's place, then spread out
            const shown = commands.flatMap((entry) =>
                entry.command === "node.set-flags" && !entry.payload.hidden
                    ? [entry.payload.nodeId]
                    : [],
            );
            const starts = new Map(shown.map((id) => [id, topic.position]));
            // the flag, the hidden flags and the starting places: one change
            model.run("batch", {
                commands: [...commands, ...movesTo(starts)],
            });
            relayout();
        },
    }));

    return (
        <ActionsContext.Provider value={actions}>
            <Flow.Root<Types, typeof features>
                features={features}
                defaultNodes={nodes}
                defaultEdges={edges}
                fitView={FIT}
                flowRef={flow}
                role="group"
                aria-label="Auto layout"
                data-animating={animating ? "" : undefined}
                data-layouts={layouts}
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
        </ActionsContext.Provider>
    );
}
