<!-- The preview: it reads the nodes wired into its two target handles, and drags by its title bar. -->
<script lang="ts">
    import { Flow, useEdges, useNodes } from "@fragiola/flow-svelte";
    import type { Node, Types } from "./index.svelte";
    import { styles } from "./styles";

    let { node }: { node: Extract<Node, { type: "preview" }> } = $props();

    const edges = useEdges<Types>();
    const nodes = useNodes<Types>();

    /** The value wired into one of the preview's handles: the source node's data, if any. */
    function inputOf(handleId: string): Node | undefined {
        const edge = edges.current.find(
            (e) => e.target === node.id && e.targetHandle === handleId,
        );
        return nodes.current.find((n) => n.id === edge?.source);
    }

    const fill = $derived.by(() => {
        const colour = inputOf("colour");
        return colour?.type === "colour" ? colour.data.colour : undefined;
    });
    const side = $derived.by(() => {
        const size = inputOf("size");
        return size?.type === "number" ? size.data.value : 32;
    });
</script>

<div data-flow-drag-handle class={styles.dragHandle}>
    <span class={styles.caption}>{node.data.label}</span>
    <span aria-hidden="true" class={styles.grip}></span>
</div>
<div class={styles.stage}>
    {#if fill}
        <div
            role="img"
            aria-label={`A ${side} pixel swatch of ${fill}`}
            class={styles.swatch}
            style:background={fill}
            style:width={`${side}px`}
            style:height={`${side}px`}
        ></div>
    {:else}
        <span class={styles.empty}>Connect a colour</span>
    {/if}
</div>
<Flow.Handle type="target" side="left" handleId="colour" class={styles.handle} style={{ top: "35%" }} />
<Flow.Handle type="target" side="left" handleId="size" class={styles.handle} style={{ top: "75%" }} />
