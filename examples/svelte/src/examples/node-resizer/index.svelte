<script module lang="ts">
    import type { FlowNodeInput, FlowTypes } from "@fragiola/flow-svelte";
    import { drag } from "@fragiola/flow-svelte/drag";
    import { keyboard } from "@fragiola/flow-svelte/keyboard";
    import { resize } from "@fragiola/flow-svelte/resize";
    import { selection } from "@fragiola/flow-svelte/selection";

    // `resize()` and `NodeResizer`: a handle on each corner and side of the node; dragging one
    // resizes the node (`node.resize`, its `width` and `height` written to the document). Each
    // resizer has its own limits over the feature's; the photo keeps its aspect ratio. The handles
    // show while the node is selected (a style on the node's `data-selected`). With `keyboard()`
    // each handle takes focus: Tab to one and use the arrows (Shift for a bigger step); each has
    // its own name, the default handles have none.

    interface Types extends FlowTypes {
        readonly nodes: {
            note: { label: string; text: string; limits: string };
            photo: { label: string };
        };
    }

    const features = [
        selection(),
        drag(),
        resize({ minWidth: 80, minHeight: 60 }),
        keyboard(),
    ] as const;

    const nodes: FlowNodeInput<Types>[] = [
        {
            id: "note",
            type: "note",
            position: { x: 0, y: 0 },
            width: 200,
            height: 120,
            selected: true,
            data: {
                label: "Note",
                text: "Resize me from any corner or side.",
                limits: "120–360 × 80–240",
            },
        },
        {
            id: "photo",
            type: "photo",
            position: { x: 260, y: 0 },
            width: 160,
            height: 120,
            data: { label: "Photo (4:3, keeps its ratio)" },
        },
    ];
</script>

<script lang="ts">
    import { typedFlow } from "@fragiola/flow-svelte";
    import { NodeResizer, RESIZE_POSITIONS, ResizeHandle } from "@fragiola/flow-svelte/resize";
    import { styles } from "./styles";

    const Flow = typedFlow<Types, typeof features>();
</script>

<Flow.Root
    {features}
    defaultNodes={nodes}
    fitView={{ padding: 0.2, maxZoom: 1 }}
    class={styles.root}
>
    <Flow.Background variant="dots" size={2} class={styles.dots} />
    <Flow.Background variant="lines" class={styles.lines} />
    <Flow.Background variant="cross" class={styles.cross} />
    <Flow.Viewport>
        <Flow.Nodes>
            {#snippet children(node)}
                <Flow.Node {node} aria-label={node.data.label} class={styles.node}>
                    <span class={styles.title}>{node.data.label}</span>
                    {#if node.type === "note"}
                        <p class={styles.text}>{node.data.text}</p>
                        <span class={styles.limits}>{node.data.limits}</span>
                        <NodeResizer
                            minWidth={120}
                            maxWidth={360}
                            minHeight={80}
                            maxHeight={240}
                            class={styles.resizer}
                        >
                            {#each RESIZE_POSITIONS as position (position)}
                                <ResizeHandle
                                    {position}
                                    aria-label="Resize {node.id}: {position}"
                                    class={styles.resizeHandle}
                                />
                            {/each}
                        </NodeResizer>
                    {:else}
                        <div role="img" aria-label="A placeholder photo" class={styles.photo}></div>
                        <NodeResizer keepAspectRatio class={styles.resizer}>
                            {#each RESIZE_POSITIONS as position (position)}
                                <ResizeHandle
                                    {position}
                                    aria-label="Resize {node.id}: {position}"
                                    class={styles.resizeHandle}
                                />
                            {/each}
                        </NodeResizer>
                    {/if}
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
    </Flow.Viewport>
</Flow.Root>
