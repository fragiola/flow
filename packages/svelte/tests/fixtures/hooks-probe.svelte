<!--
    Reads one of #36's runes (`use`, called in its script) and records in `seen` each value it
    notified with (an effect reading `current`: Svelte's re-render), and shows the last one.
-->
<script lang="ts">
    import { untrack } from "svelte";
    import type { FlowValue } from "../../src/index.js";

    let { use, seen }: { use: () => FlowValue<unknown>; seen: unknown[] } =
        $props();
    const value = untrack(() => use());
    $effect.pre(() => {
        const current = value.current;
        untrack(() => seen.push(current));
    });
</script>

<span data-flow-part="probe">{String(value.current)}</span>
