<script setup lang="ts">
import { type FlowEdge, useFlowStore } from "@fragiola/flow-vue";
import { SendIcon } from "@lucide/vue";
import { watchEffect } from "vue";
import type { features, Types } from "./index.vue";
import { styles } from "./styles";

// The sender's body: "Send a value" starts the pulse while the flow still has its edge.

const props = defineProps<{ label: string; sending: boolean }>();
const emit = defineEmits<{ send: []; drop: [] }>();

/** Whether the flow still has the edge that pulses: deleted, nothing carries a value. */
const pulse = useFlowStore<boolean, Types, typeof features>(({ model }) =>
    model
        .get("all-edges")
        .some(
            (edge: FlowEdge<Types>) =>
                edge.type === "animated" && edge.data?.motion === "pulse",
        ),
);

// the pulse's edge deleted while a value was on its way: no animationend will come
watchEffect(() => {
    if (props.sending && !pulse.value) emit("drop");
});

function onSend() {
    if (pulse.value) emit("send");
}
</script>

<template>
    <div :class="styles.body">
        {{ label }}
        <button
            type="button"
            aria-label="Send a value"
            :disabled="sending"
            :class="styles.send"
            @click="onSend"
        >
            <SendIcon aria-hidden="true" />
            Send
        </button>
    </div>
</template>
