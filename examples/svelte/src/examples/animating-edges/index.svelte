<script module lang="ts">
    import type { FlowEdgeInput, FlowNodeInput, FlowTypes } from "@fragiola/flow-svelte";
    import { drag } from "@fragiola/flow-svelte/drag";
    import { keyboard } from "@fragiola/flow-svelte/keyboard";
    import { selection } from "@fragiola/flow-svelte/selection";
    import type { Motion } from "./motion";

    // The package animates nothing: an edge moves by what the app puts in it. A dot travels along the
    // first edge (an SVG `<animateMotion>` whose `path` is the edge's own, `useEdge(edge).state.path`,
    // so it follows the edge while a node is dragged), dashes flow along the second (an `<animate>` of
    // the path's `stroke-dashoffset`), and the third pulses once when a value passes: "Send a value"
    // marks it `data-pulsing`, its style runs one pulse, and `animationend` clears the mark and hands
    // the value over. Under `prefers-reduced-motion` (read with `matchMedia`, followed live) neither
    // the dot nor the dashes move, and those edges say so (`data-reduced-motion`).

    export interface Types extends FlowTypes {
        readonly nodes: {
            step: { label: string };
            sender: { label: string };
            counter: { label: string };
        };
        readonly edges: { animated: { motion: Motion } };
    }

    export const features = [selection(), drag(), keyboard()] as const;

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

    export const LABELS: Record<string, string> = Object.fromEntries(
        nodes.map((node) => [node.id, node.data.label]),
    );
</script>

<script lang="ts">
    import { typedFlow } from "@fragiola/flow-svelte";
    import AnimatedEdge from "./animated-edge.svelte";
    import CounterBody from "./counter-body.svelte";
    import { onReducedMotionChange, prefersReducedMotion } from "./motion";
    import SenderBody from "./sender-body.svelte";
    import { styles } from "./styles";

    const Flow = typedFlow<Types, typeof features>();

    /** Whether the user asked for reduced motion, followed live; a server render assumes not. */
    let reduced = $state(false);
    $effect(() => {
        reduced = prefersReducedMotion();
        return onReducedMotionChange(() => {
            reduced = prefersReducedMotion();
        });
    });

    // The values passing from the sender to the counter: app state, outside the flow's document.
    /** a value is on its way: the pulse is running */
    let sending = $state(false);
    /** how many values the counter has received */
    let received = $state(0);

    const send = () => {
        sending = true;
    };
    /** the pulse ended: the value arrives */
    const arrive = () => {
        sending = false;
        received += 1;
    };
    /** the pulse's edge is gone: the value is dropped */
    const drop = () => {
        sending = false;
    };
</script>

<Flow.Root
    {features}
    defaultNodes={nodes}
    defaultEdges={edges}
    fitView={{ padding: 0.15, maxZoom: 1 }}
    role="group"
    aria-label="Animating edges"
    class={styles.root}
>
    <Flow.Background variant="dots" size={2} class={styles.dots} />
    <Flow.Background variant="lines" class={styles.lines} />
    <Flow.Background variant="cross" class={styles.cross} />
    <Flow.Viewport>
        <Flow.Edges>
            {#snippet children(edge)}
                <AnimatedEdge {edge} {reduced} {sending} onarrive={arrive} />
            {/snippet}
        </Flow.Edges>
        <Flow.Nodes>
            {#snippet children(node)}
                <Flow.Node
                    {node}
                    role="group"
                    aria-roledescription="node"
                    aria-label={node.data.label}
                    class={styles.node}
                >
                    <Flow.Handle type="target" side="left" class={styles.handle} />
                    {#if node.type === "sender"}
                        <SenderBody label={node.data.label} {sending} onsend={send} ondrop={drop} />
                    {:else if node.type === "counter"}
                        <CounterBody label={node.data.label} {received} />
                    {:else}
                        {node.data.label}
                    {/if}
                    <Flow.Handle type="source" side="right" class={styles.handle} />
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
    </Flow.Viewport>
</Flow.Root>
