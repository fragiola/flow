<script module lang="ts">
    import type { FlowTypes } from "@fragiola/flow-svelte";
    import { drag } from "@fragiola/flow-svelte/drag";
    import { selection } from "@fragiola/flow-svelte/selection";

    // A flow of thousands of nodes and as many edges, generated (generate.ts: a seeded grid joined into
    // one tree, the same every time), 1,000 by default and up to 20,000. `onlyRenderVisible` keeps in
    // the DOM only the nodes and edges in view, so the DOM stays small whatever the size; the readout
    // shows what each gesture costs. The nodes declare their size and handles, so a node never drawn
    // still has a box (it is culled rightly) and its edges have ends. Until the root has a size (the
    // view known), a culled flow renders no node, so no more than the visible ones ever mount.
    // "Shuffle" moves every node in one `batch`: one change, one render. The readout counts the nodes
    // and edges in the DOM and times the frames (requestAnimationFrame, the median of the last 60,
    // frames.ts), the last size switch and the last shuffle (until the next frame).

    export interface Types extends FlowTypes {
        readonly nodes: { cell: { label: string } };
    }

    export const features = [selection(), drag()] as const;

    /** How the size picker names a size: "10,000 nodes". */
    const sizeName = (size: number) => `${size.toLocaleString("en-US")} nodes`;

    /** A node's place as it prints it, for the tests: "x, y", rounded. */
    const placeOf = (position: { readonly x: number; readonly y: number }) =>
        `${Math.round(position.x)}, ${Math.round(position.y)}`;

    /** Calls `done` with the time since `start` once the next frame begins (the change is drawn). */
    function timeToFrame(start: number, done: (ms: number) => void) {
        requestAnimationFrame(() => done(performance.now() - start));
    }
</script>

<script lang="ts">
    import { typedFlow, useFlowRef } from "@fragiola/flow-svelte";
    import { ShuffleIcon } from "@lucide/svelte";
    import { formatMs, frameMeter } from "./frames";
    import { generateFlow, labelOf, SIZES, type Size, shuffle } from "./generate";
    import { styles } from "./styles";

    const Flow = typedFlow<Types, typeof features>();

    let size = $state<Size>(SIZES[0]);
    const flowData = $derived(generateFlow(size));
    const flow = useFlowRef<Types, typeof features>();
    let frame = $state<HTMLDivElement>();
    // when the shown size was asked for: the first render, then each switch
    let switchedAt = performance.now();
    let renderMs = $state<number>();
    let shuffleMs = $state<number>();
    let shuffles = 0;

    // The nodes and edges in the DOM and the frame time, read a few times a second.
    let counts = $state.raw<{
        readonly nodes: number;
        readonly edges: number;
        readonly frameMs: number | undefined;
    }>({ nodes: 0, edges: 0, frameMs: undefined });
    $effect(() => {
        const meter = frameMeter(60);
        let ticks = 0;
        let id = requestAnimationFrame(function onFrame(time) {
            meter.tick(time);
            ticks += 1;
            // every 15th frame: a readout updated each frame would cost frames itself
            if (ticks % 15 === 0 && frame) {
                counts = {
                    nodes: frame.querySelectorAll('[data-flow-part="node"]').length,
                    edges: frame.querySelectorAll('[data-flow-part="edge"]').length,
                    frameMs: meter.median(),
                };
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
    });

    function onInit() {
        timeToFrame(switchedAt, (ms) => {
            renderMs = ms;
        });
    }

    function onSize(value: string) {
        const next = SIZES.find((option) => String(option) === value);
        if (next === undefined || next === size) return;
        switchedAt = performance.now();
        renderMs = undefined;
        shuffleMs = undefined;
        size = next;
    }

    function onShuffle() {
        const model = flow.current?.model;
        if (!model) return;
        shuffles += 1;
        const start = performance.now();
        const moves = shuffle(model.get("all-nodes"), shuffles + 1);
        // every move in one batch: one change of the document, one render
        model.run("batch", {
            commands: moves.map((payload) => ({
                command: "node.move" as const,
                payload,
            })),
        });
        timeToFrame(start, (ms) => {
            shuffleMs = ms;
        });
    }
</script>

<div bind:this={frame} class={styles.frame}>
    <!-- a new size is a new flow -->
    {#key size}
        <Flow.Root
            {features}
            defaultNodes={flowData.nodes}
            defaultEdges={flowData.edges}
            defaultViewport={{ x: 48, y: 120, zoom: 1 }}
            minZoom={0.1}
            onlyRenderVisible
            flowRef={flow}
            oninit={onInit}
            role="group"
            aria-label="Stress test"
            aria-busy={renderMs === undefined}
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
                        <!-- a cheap node: one element and its label, its place on it for the tests -->
                        <Flow.Node
                            {node}
                            role="group"
                            aria-roledescription="node"
                            aria-label={node.data.label}
                            data-position={placeOf(node.position)}
                            class={styles.node}
                        >
                            {node.data.label}
                        </Flow.Node>
                    {/snippet}
                </Flow.Nodes>
            </Flow.Viewport>
        </Flow.Root>
    {/key}
    <div data-flow-no-gesture="" class={styles.panel}>
        <label class={styles.field}>
            <span>Size</span>
            <select
                value={size}
                onchange={(event) => onSize(event.currentTarget.value)}
                class={styles.select}
            >
                {#each SIZES as option (option)}
                    <option value={option}>{sizeName(option)}</option>
                {/each}
            </select>
        </label>
        <button type="button" onclick={onShuffle} class={styles.button}>
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
            class={styles.readout}
        >
            <div class={styles.stat}>
                <dt>In the DOM</dt>
                <dd class={styles.value}>{counts.nodes} nodes, {counts.edges} edges</dd>
            </div>
            <div class={styles.stat}>
                <dt>Frame</dt>
                <dd class={styles.value}>{formatMs(counts.frameMs)} ms</dd>
            </div>
            <div class={styles.stat}>
                <dt>Rendered in</dt>
                <dd class={styles.value}>{formatMs(renderMs)} ms</dd>
            </div>
            <div class={styles.stat}>
                <dt>Shuffled in</dt>
                <dd class={styles.value}>{formatMs(shuffleMs)} ms</dd>
            </div>
        </dl>
    </div>
</div>
