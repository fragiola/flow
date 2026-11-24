<!-- The other collaborators' pointers, in flow coordinates (inside `Flow.Viewport`). -->
<script lang="ts">
    import { MousePointer2Icon } from "@lucide/svelte";
    import { styles } from "./styles";
    import type { Presence } from "./sync";

    const { presence }: { presence: Presence } = $props();
</script>

{#each presence as [id, { name, at }] (id)}
    {#if at}
        <div
            data-testid="cursor"
            data-peer={name}
            class={styles.cursor(name)}
            style:transform={`translate(${at.x}px, ${at.y}px)`}
        >
            <MousePointer2Icon aria-hidden="true" />
            <span class={styles.cursorName}>{name}</span>
        </div>
    {/if}
{/each}
