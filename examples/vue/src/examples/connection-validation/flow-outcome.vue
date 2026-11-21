<script setup lang="ts">
import { useFlow } from "@fragiola/flow-vue";
import { onMounted, onUnmounted, ref } from "vue";
import { type features, PORTS, type Types } from "./index.vue";
import { styles } from "./styles";

// The legend, and how the last connection ended (the engine's events, inside the root).

const { engine } = useFlow<Types, typeof features>();
const outcome = ref("Drag from an output to an input.");
let stop = () => {};
onMounted(() => {
    stop = engine.subscribe((event) => {
        if (event.type === "connect") outcome.value = "Connected.";
        if (event.type === "connect-cancel") {
            outcome.value = event.refused
                ? "Refused: the rules do not allow that connection."
                : "Dropped nowhere: nothing changed.";
        }
    });
});
onUnmounted(() => stop());
</script>

<template>
    <div :class="styles.legend">
        <span v-for="port in PORTS" :key="port" :class="styles.key(port)">
            {{ port }}
        </span>
        <p role="status" data-testid="outcome" :class="styles.outcome">
            {{ outcome }}
        </p>
    </div>
</template>
