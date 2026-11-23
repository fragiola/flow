<script setup lang="ts">
import { PlusIcon } from "@lucide/vue";
import { inject } from "vue";
import { ACTIONS } from "./index.vue";
import { styles } from "./styles";
import type { PlaceholderData } from "./tree";

// The "+" under a topic: adds a child to it.

defineProps<{ data: PlaceholderData }>();

const actions = inject(ACTIONS);
</script>

<template>
    <button
        type="button"
        :aria-label="`Add a child to ${data.parentLabel}`"
        :class="styles.add"
        @click="actions?.add(data.parentId)"
    >
        <PlusIcon aria-hidden="true" :class="styles.icon" />
    </button>
</template>
