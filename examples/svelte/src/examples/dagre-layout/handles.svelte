<script lang="ts">
    import { Flow } from "@fragiola/flow-svelte";
    import { type Direction, HANDLE_SIDES } from "./layout";
    import { styles } from "./styles";

    // A node's handles, on the sides the direction gives; remounted (`{#key}`) when it changes, as
    // the engine reads a handle's side when it registers.

    let { direction }: { direction: Direction } = $props();
</script>

{#key direction}
    <Flow.Handle type="target" side={HANDLE_SIDES[direction].target} class={styles.handle} />
    <Flow.Handle type="source" side={HANDLE_SIDES[direction].source} class={styles.handle} />
{/key}
