<script setup lang="ts">
import { styles } from "./styles";

// The counter's body: how many values it has received, announced as they arrive.

defineProps<{ label: string; received: number }>();
</script>

<template>
    <div :class="styles.body">
        {{ label }}
        <output
            aria-live="polite"
            aria-label="Values received"
            data-testid="received"
            :class="styles.received"
        >
            {{ received }}
        </output>
    </div>
</template>
