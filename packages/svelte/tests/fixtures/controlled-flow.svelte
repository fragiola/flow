<!--
    `TestFlow` with `bind:nodes` and `bind:edges` over this component's `$state.raw` (or, with
    `deep`, a deep `$state` list: proxies), driven by the test through its exports.
-->
<script lang="ts">
    import type { FlowEdge, FlowNode, RootProps } from "../../src/index.js";
    import TestFlow from "./test-flow.svelte";

    let {
        initialNodes,
        initialEdges,
        deep = false,
        ...rest
    }: RootProps & {
        initialNodes?: readonly FlowNode[];
        initialEdges?: readonly FlowEdge[];
        deep?: boolean;
    } = $props();

    // svelte-ignore state_referenced_locally
    let raw = $state.raw<readonly FlowNode[] | undefined>(initialNodes);
    // svelte-ignore state_referenced_locally
    let proxied = $state<FlowNode[]>([...(initialNodes ?? [])]);
    // svelte-ignore state_referenced_locally
    let edges = $state.raw<readonly FlowEdge[] | undefined>(initialEdges);

    export function setNodes(next: readonly FlowNode[]): void {
        if (deep) proxied = [...next];
        else raw = next;
    }
    export function pushNode(node: FlowNode): void {
        proxied.push(node);
        proxied = [...proxied];
    }
    export function getNodes(): readonly FlowNode[] | undefined {
        return deep ? proxied : raw;
    }
    export function setEdges(next: readonly FlowEdge[]): void {
        edges = next;
    }
    export function getEdges(): readonly FlowEdge[] | undefined {
        return edges;
    }
</script>

{#if deep}
    <TestFlow bind:nodes={proxied} bind:edges {...rest} />
{:else}
    <TestFlow bind:nodes={raw} bind:edges {...rest} />
{/if}
