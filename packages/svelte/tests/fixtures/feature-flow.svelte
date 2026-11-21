<!-- The features' primitives: a resizer per node (`maxWidth`), the minimap, a selection reader. -->
<script lang="ts">
    import { Flow, type RootProps } from "../../src/index.js";
    import { MiniMap } from "../../src/minimap/index.js";
    import { NodeResizer } from "../../src/resize/index.js";
    import Selected from "./selected.svelte";

    let {
        resizer = false,
        map = false,
        onselection,
        ...rest
    }: RootProps & {
        resizer?: boolean;
        map?: boolean;
        onselection?: (ids: string[]) => void;
    } = $props();
</script>

<Flow.Root {...rest}>
    <Flow.Viewport>
        <Flow.Edges>
            {#snippet children(edge)}
                <Flow.Edge {edge} />
            {/snippet}
        </Flow.Edges>
        <Flow.Nodes>
            {#snippet children(node)}
                <Flow.Node {node}>
                    {#if resizer}<NodeResizer maxWidth={150} />{/if}
                </Flow.Node>
            {/snippet}
        </Flow.Nodes>
    </Flow.Viewport>
    <Flow.SelectionBox />
    {#if map}<MiniMap width={200} height={150} />{/if}
    {#if onselection}<Selected {onselection} />{/if}
</Flow.Root>
