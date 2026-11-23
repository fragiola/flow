<!-- The zoom as a percentage and the level it gives, from `useViewport()`. -->
<script lang="ts">
    import { useViewport } from "@fragiola/flow-svelte";
    import { detailOf } from "./detail";
    import { styles } from "./styles";

    const viewport = useViewport();
</script>

<p data-testid="zoom-readout" class={styles.readout}>
    {Math.round(viewport.current.zoom * 100)}% · {detailOf(viewport.current.zoom)} detail
</p>
