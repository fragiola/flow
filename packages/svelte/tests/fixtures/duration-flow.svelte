<!-- `TestFlow` with control buttons that animate (`duration`), and one that does not. -->
<script lang="ts">
    import { Flow, type RootProps } from "../../src/index.js";
    import TestFlow from "./test-flow.svelte";

    let { ...rest }: RootProps = $props();
</script>

<TestFlow {...rest}>
    {#snippet extra()}
        <Flow.ZoomIn data-testid="in" duration={300} />
        <Flow.ZoomOut data-testid="out" duration={200} />
        <Flow.FitView data-testid="fit" duration={400} />
        <Flow.ZoomIn data-testid="plain" />
    {/snippet}
</TestFlow>
