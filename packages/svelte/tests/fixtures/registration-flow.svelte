<!--
    A flow whose nodes tell whether the engine has registered them when their content mounts:
    node `c` rendered by hand (`useNode`, `registration-node.svelte`), every other one a `Flow.Node`
    with `registration-content.svelte` inside. Each pushes `[who, registered]` into `seen`.
-->
<script lang="ts">
    import { Flow, type FlowNode, type RootProps } from "../../src/index.js";
    import RegistrationContent from "./registration-content.svelte";
    import RegistrationNode from "./registration-node.svelte";

    let {
        seen = [],
        ...rest
    }: RootProps & { seen?: [string, boolean][] } = $props();
</script>

<Flow.Root {...rest}>
    <Flow.Viewport>
        <Flow.Nodes>
            {#snippet children(node: FlowNode)}
                {#if node.id === "c"}
                    <RegistrationNode {node} {seen} />
                {:else}
                    <Flow.Node {node}>
                        <RegistrationContent id={node.id} {seen} />
                    </Flow.Node>
                {/if}
            {/snippet}
        </Flow.Nodes>
    </Flow.Viewport>
</Flow.Root>
