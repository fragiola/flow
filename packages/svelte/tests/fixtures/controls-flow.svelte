<!-- `TestFlow` with control buttons, a background of its own and a toggle, for the viewport. -->
<script lang="ts">
    import { Flow, type RootProps } from "../../src/index.js";
    import TestFlow from "./test-flow.svelte";

    let {
        viewport = $bindable(),
        zoomInClick,
        ...rest
    }: RootProps & { zoomInClick?: () => void } = $props();
</script>

<TestFlow bind:viewport {...rest}>
    {#snippet extra()}
        <Flow.ZoomIn data-testid="in" onclick={zoomInClick} />
        <Flow.ZoomOut data-testid="out" />
        <Flow.FitView data-testid="fit" />
        <Flow.ToggleInteractive data-testid="lock" />
    {/snippet}
</TestFlow>
