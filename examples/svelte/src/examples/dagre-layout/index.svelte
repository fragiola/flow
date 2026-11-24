<script module lang="ts">
    import type { FlowEdgeInput, FlowNodeInput, FlowTypes } from "@fragiola/flow-svelte";
    import { drag } from "@fragiola/flow-svelte/drag";
    import { selection } from "@fragiola/flow-svelte/selection";
    import { type Direction, layoutPositions, type Point } from "./layout";

    // A tree laid out by dagre (`layout.ts`): the nodes declare their size, dagre ranks them from
    // the root and places them, and the flow opens laid out (the positions are computed before the
    // first render) and fitted to the view. "Direction" lays it out again top to bottom or left to
    // right: each node's handles move to the sides the tree now grows by (handles.svelte, given the
    // direction as a prop and remounted per direction, `{#key}`, as the engine reads a handle's side
    // when it registers), and the nodes glide to their new places: one transient `batch` of
    // `node.move` per animation frame, eased (`tween.ts`), then one batch that is not transient
    // with the exact places (one step for a history or a save), then `fit-view` animated. The root
    // carries `data-direction`, and `data-animating` while the nodes move.

    export interface Types extends FlowTypes {
        readonly nodes: { step: { label: string } };
    }

    export const features = [selection(), drag()] as const;

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

    /** A node's place as it prints it, for the tests: "x, y", rounded. */
    const placeOf = (position: Point) => `${Math.round(position.x)}, ${Math.round(position.y)}`;
</script>

<script lang="ts">
    import { typedFlow, useFlowRef } from "@fragiola/flow-svelte";
    import Handles from "./handles.svelte";
    import { DIRECTIONS } from "./layout";
    import { styles } from "./styles";
    import { tween } from "./tween";

    const Flow = typedFlow<Types, typeof features>();

    const flow = useFlowRef<Types, typeof features>();
    let direction = $state<Direction>(FIRST);
    let animating = $state(false);

    // the running animation's stop, so a new direction (or leaving) ends it
    let stop: (() => void) | undefined;
    $effect(() => () => stop?.());

    function arrange(next: Direction) {
        const current = flow.current;
        if (!current || next === direction) return;
        const { model, engine } = current;
        stop?.();
        direction = next;
        const all = model.get("all-nodes");
        // from where the nodes are now: mid-animation, or after a drag
        const from = new Map(all.map((node) => [node.id, node.position]));
        const to = layoutPositions(all.map(boxOf), model.get("all-edges"), next);
        animating = true;
        stop = everyFrame(DURATION, (t) => {
            if (t < 1) {
                // a step of the animation: transient, as a drag's steps are
                model.run("batch", { commands: movesTo(tween(from, to, t)) }, { transient: true });
                return;
            }
            // the exact places, once: the one change a history or a save keeps
            model.run("batch", { commands: movesTo(to) });
            stop = undefined;
            animating = false;
            engine.run("fit-view", { ...FIT, duration: 300 });
        });
    }
</script>

<Flow.Root
    {features}
    defaultNodes={nodes}
    defaultEdges={edges}
    fitView={FIT}
    flowRef={flow}
    role="group"
    aria-label="Dagre layout"
    data-direction={direction}
    data-animating={animating ? "" : undefined}
    class={styles.root}
>
    <Flow.Background variant="dots" size={2} class={styles.dots} />
    <Flow.Background variant="lines" class={styles.lines} />
    <Flow.Background variant="cross" class={styles.cross} />
    <Flow.Viewport>
        <Flow.Edges>
            {#snippet children(edge)}
                <Flow.Edge
                    {edge}
                    role="group"
                    aria-roledescription="edge"
                    aria-label={`${labelOf(edge.source)} to ${labelOf(edge.target)}`}
                    class={styles.edgeGroup}
                >
                    <Flow.EdgePath class={styles.edge} />
                </Flow.Edge>
            {/snippet}
        </Flow.Edges>
        <Flow.Nodes>
            {#snippet children(node)}
                <Flow.Node
                    {node}
                    role="group"
                    aria-roledescription="node"
                    aria-label={node.data.label}
                    data-position={placeOf(node.position)}
                    class={styles.node}
                >
                    <Handles {direction} />
                    {node.data.label}
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
    </Flow.Viewport>
    <fieldset class={styles.panel}>
        <legend class={styles.legend}>Direction</legend>
        {#each DIRECTIONS as option (option)}
            <label class={styles.option}>
                <input
                    type="radio"
                    name="dagre-direction"
                    value={option}
                    checked={direction === option}
                    onchange={() => arrange(option)}
                    class={styles.radio}
                />
                {DIRECTION_NAMES[option]}
            </label>
        {/each}
    </fieldset>
</Flow.Root>
