<!-- A node rendered by hand with `useNode`: an `<article>` with the node's props spread on it. -->
<script lang="ts">
    import { type FlowNode, useNode } from "../../src/index.js";

    let { node }: { node: FlowNode } = $props();
    const own = useNode(() => node);
</script>

<article {...own.props} data-x={own.state.x}></article>
