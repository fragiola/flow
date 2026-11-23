<script setup lang="ts">
import { useViewport } from "@fragiola/flow-vue";
import { detailOf } from "./detail";
import { styles } from "./styles";

// The zoom as a percentage and the level it gives, from `useViewport()`.

const viewport = useViewport();
</script>

<template>
    <p data-testid="zoom-readout" :class="styles.readout">
        {{ Math.round(viewport.zoom * 100) }}% · {{ detailOf(viewport.zoom) }} detail
    </p>
</template>
