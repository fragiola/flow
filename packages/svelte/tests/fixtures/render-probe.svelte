<!--
    Counts its renders: `seen(id)` each time `value` (a part's state, or its entity) is a new object.
    An effect, not a template call (a template's `{f(x.current)}` is no render count: AGENTS.md).
    It renders nothing, so it may sit in an SVG.
-->
<script lang="ts">
    import { untrack } from "svelte";

    let {
        id,
        value,
        seen,
    }: { id: string; value: unknown; seen?: ((id: string) => void) | undefined } =
        $props();
    $effect.pre(() => {
        void value;
        untrack(() => seen?.(id));
    });
</script>
