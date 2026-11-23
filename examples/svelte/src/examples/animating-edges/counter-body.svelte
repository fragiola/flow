<!-- The counter's body: how many values it has received, announced as they arrive. -->
<script lang="ts">
    import { styles } from "./styles";

    let { label, received }: { label: string; received: number } = $props();
</script>

<div class={styles.body}>
    {label}
    <output aria-live="polite" aria-label="Values received" data-testid="received" class={styles.received}>
        {received}
    </output>
</div>
