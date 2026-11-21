<script lang="ts">
    import { Flow, type RootProps } from "../../src/index.js";

    let rest: RootProps = $props();
</script>

<Flow.Root {...rest}>
    <Flow.Background variant="lines" gap={10} />
    <Flow.Viewport />
</Flow.Root>
