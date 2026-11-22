<!--
    A flow that tells what renders: `onrender(kind, entity)` each time a node's or an edge's
    snippet reads its entity again, `onmount(id)` when a node's content mounts. `mark` is read by
    the snippets (an outer value), `alt` hands `Flow.Nodes` another snippet, `viewportStyle` is the viewport's style, `nodeStyle` each node's.
-->
<script lang="ts">
    import { Flow, type FlowEdge, type FlowNode, type RootProps } from "../../src/index.js";
    import Counted from "./counted.svelte";

    let {
        onrender,
        onmount,
        mark = "off",
        alt = false,
        viewportStyle,
        nodeStyle,
        ...rest
    }: RootProps & {
        viewportStyle?: string;
        nodeStyle?: string;
        onrender?: (kind: string, entity: FlowNode | FlowEdge) => void;
        onmount?: (id: string) => void;
        mark?: string;
        alt?: boolean;
    } = $props();
</script>

{#snippet node(entity: FlowNode)}
    <Flow.Node node={entity} data-mark={mark} data-snippet="a" style={nodeStyle}>
        {(onrender?.("node", entity), "")}
        <Counted id={entity.id} {onmount} />
    </Flow.Node>
{/snippet}

{#snippet other(entity: FlowNode)}
    <Flow.Node node={entity} data-mark={mark} data-snippet="b" />
{/snippet}

{#snippet edge(entity: FlowEdge)}
    <Flow.Edge edge={entity} data-mark={mark}>
        <Flow.EdgePath />
        {(onrender?.("edge", entity), "")}
    </Flow.Edge>
{/snippet}

<Flow.Root {...rest}>
    <Flow.Viewport style={viewportStyle}>
        <Flow.Edges children={edge} />
        <Flow.Nodes children={alt ? other : node} />
    </Flow.Viewport>
</Flow.Root>
