<script setup lang="ts">
import { MousePointer2Icon } from "@lucide/vue";
import type { Ref } from "vue";
import { styles } from "./styles";
import type { Presence } from "./sync";

// The other collaborators' pointers, in flow coordinates (inside `Flow.Viewport`). It is given the
// presence's ref, not its value: only this component re-renders as a pointer moves, never the
// viewport around it, nor the nodes.

defineProps<{ presence: Readonly<Ref<Presence>> }>();
</script>

<template>
    <template v-for="[id, { name, at }] in presence.value" :key="id">
        <div
            v-if="at"
            data-testid="cursor"
            :data-peer="name"
            :class="styles.cursor(name)"
            :style="{ transform: `translate(${at.x}px, ${at.y}px)` }"
        >
            <MousePointer2Icon aria-hidden="true" />
            <span :class="styles.cursorName">{{ name }}</span>
        </div>
    </template>
</template>
