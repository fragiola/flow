<script setup lang="ts">
import { typedFlow } from "@fragiola/flow-vue";
import { inject, ref } from "vue";
import { DIRECTION, FIRST, type features, type Types } from "./index.vue";
import { HANDLE_SIDES } from "./layout";
import { styles } from "./styles";

// A node's handles, on the sides the direction gives; remounted (`key`) when it changes, as the
// engine reads a handle's side when it registers.

const Flow = typedFlow<Types, typeof features>();

const direction = inject(DIRECTION, ref(FIRST));
</script>

<template>
    <Flow.Handle
        :key="`target-${direction}`"
        type="target"
        :side="HANDLE_SIDES[direction].target"
        :class="styles.handle"
    />
    <Flow.Handle
        :key="`source-${direction}`"
        type="source"
        :side="HANDLE_SIDES[direction].source"
        :class="styles.handle"
    />
</template>
