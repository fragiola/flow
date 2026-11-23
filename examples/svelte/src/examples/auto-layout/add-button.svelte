<!-- The "+" under a topic: adds a child to it. -->
<script lang="ts">
    import { PlusIcon } from "@lucide/svelte";
    import { styles } from "./styles";
    import type { PlaceholderData } from "./tree";

    let { data, onadd }: { data: PlaceholderData; onadd: (parentId: string) => void } = $props();
</script>

<button
    type="button"
    aria-label={`Add a child to ${data.parentLabel}`}
    onclick={() => onadd(data.parentId)}
    class={styles.add}
>
    <PlusIcon aria-hidden="true" class={styles.icon} />
</button>
