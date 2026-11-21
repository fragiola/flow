<!-- What `Portal` mounts in its target: its children. -->
<script lang="ts">
    import type { Snippet } from "svelte";

    let { children }: { children: Snippet } = $props();
</script>

{@render children()}
