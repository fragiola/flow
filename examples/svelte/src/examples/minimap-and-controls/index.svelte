<script module lang="ts">
    import type {
        FlowEdgeInput,
        FlowNodeInput,
        FlowTypes,
    } from "@fragiola/flow-svelte";
    import { drag } from "@fragiola/flow-svelte/drag";
    import { minimap } from "@fragiola/flow-svelte/minimap";
    import { selection } from "@fragiola/flow-svelte/selection";

    // `minimap()` draws the whole flow small (`MiniMap`): a `MiniMapNode` per node and a `MiniMapMask`
    // over what the root does not show; dragging in it pans the flow, the wheel over it zooms.
    // `Flow.Controls` groups the buttons; each runs one engine action and is disabled while the engine
    // refuses it (at the zoom limits). The lock (`Flow.ToggleInteractive`) stops every gesture that
    // changes the flow; pan and zoom stay. Its default slot gets its state: the icon follows the lock.

    interface Types extends FlowTypes {
        readonly nodes: { city: { label: string } };
    }

    const features = [selection(), drag(), minimap()] as const;

    const CITIES = [
        ["lisbon", "Lisbon", -500, 300],
        ["madrid", "Madrid", -300, 260],
        ["paris", "Paris", -120, -40],
        ["london", "London", -220, -240],
        ["amsterdam", "Amsterdam", 60, -230],
        ["berlin", "Berlin", 300, -170],
        ["prague", "Prague", 320, 30],
        ["vienna", "Vienna", 460, 160],
        ["rome", "Rome", 220, 420],
        ["milan", "Milan", 40, 200],
    ] as const;

    const nodes: FlowNodeInput<Types>[] = CITIES.map(([id, label, x, y]) => ({
        id,
        type: "city",
        position: { x, y },
        data: { label },
    }));

    const ROUTE = [
        "lisbon",
        "madrid",
        "paris",
        "london",
        "amsterdam",
        "berlin",
        "prague",
        "vienna",
        "rome",
        "milan",
        "paris",
    ];

    const edges: FlowEdgeInput<Types>[] = ROUTE.slice(1).map((target, index) => ({
        id: `${ROUTE[index]}-${target}`,
        source: ROUTE[index] as string,
        target,
        type: "straight",
    }));
</script>

<script lang="ts">
    import { typedFlow } from "@fragiola/flow-svelte";
    import { MiniMap, MiniMapMask, MiniMapNode } from "@fragiola/flow-svelte/minimap";
    import { LockIcon, MaximizeIcon, MinusIcon, PlusIcon, UnlockIcon } from "@lucide/svelte";
    import { styles } from "./styles";

    const Flow = typedFlow<Types, typeof features>();
</script>

<Flow.Root
    {features}
    defaultNodes={nodes}
    defaultEdges={edges}
    fitView={{ padding: 0.1 }}
    minZoom={0.25}
    maxZoom={2}
    class={styles.root}
>
    <Flow.Background variant="dots" size={2} class={styles.dots} />
    <Flow.Background variant="lines" class={styles.lines} />
    <Flow.Background variant="cross" class={styles.cross} />
    <Flow.Viewport>
        <Flow.Edges>
            {#snippet children(edge)}
                <Flow.Edge {edge}>
                    <Flow.EdgePath class={styles.edge} />
                </Flow.Edge>
            {/snippet}
        </Flow.Edges>
        <Flow.Nodes>
            {#snippet children(node)}
                <Flow.Node {node} class={styles.node}>
                    {node.data.label}
                    <Flow.Handle type="target" side="top" class={styles.anchor} />
                    <Flow.Handle type="source" side="bottom" class={styles.anchor} />
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
    </Flow.Viewport>
    <Flow.Controls role="group" aria-label="Zoom and lock" class={styles.controls}>
        <Flow.ZoomIn aria-label="Zoom in" class={styles.control}>
            <PlusIcon />
        </Flow.ZoomIn>
        <Flow.ZoomOut aria-label="Zoom out" class={styles.control}>
            <MinusIcon />
        </Flow.ZoomOut>
        <Flow.FitView aria-label="Fit view" class={styles.control}>
            <MaximizeIcon />
        </Flow.FitView>
        <Flow.ToggleInteractive aria-label="Lock the flow" class={styles.control}>
            {#snippet render({ props, state })}
                <button {...props}>
                    {#if state.interactive}
                        <UnlockIcon />
                    {:else}
                        <LockIcon />
                    {/if}
                </button>
            {/snippet}
        </Flow.ToggleInteractive>
    </Flow.Controls>
    <MiniMap
        width={180}
        height={130}
        role="img"
        aria-label="Minimap of the route"
        class={styles.minimap}
    >
        {#snippet children(view)}
            {#each view.nodes as node (node.nodeId)}
                <MiniMapNode nodeId={node.nodeId} class={styles.minimapNode} />
            {/each}
            <MiniMapMask class={styles.minimapMask} />
        {/snippet}
    </MiniMap>
</Flow.Root>
