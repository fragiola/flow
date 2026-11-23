<script setup lang="ts">
import { useFlow } from "@fragiola/flow-vue";
import { onMounted, ref, watch } from "vue";
import type { features, Node, Types } from "./index.vue";
import { styles } from "./styles";

// The label, or its field while it is edited in place: Enter (or leaving the field) keeps it,
// Escape drops it.

const props = defineProps<{ node: Node; editing: boolean }>();
const emit = defineEmits<{ editing: [on: boolean] }>();

const { model } = useFlow<Types, typeof features>();
const field = ref<HTMLInputElement | null>(null);
// Escape drops the edit: the blur that follows must not keep it
let dropped = false;

// each edit starts undropped, its field focused: the field may go without a blur, leaving the
// flag set
watch(
    () => props.editing,
    (editing) => {
        if (editing) dropped = false;
    },
);
watch(field, (element) => element?.focus());
onMounted(() => field.value?.focus());

function keep(value: string) {
    const label = value.trim();
    if (label !== "" && label !== props.node.data.label) {
        model.run("node.set-data", { nodeId: props.node.id, data: { label } });
    }
    emit("editing", false);
}

function onKeyDown(event: KeyboardEvent) {
    const input = event.currentTarget as HTMLInputElement;
    if (event.key === "Enter") keep(input.value);
    if (event.key === "Escape") {
        dropped = true;
        emit("editing", false);
    }
}

function onBlur(event: FocusEvent) {
    if (dropped) dropped = false;
    else keep((event.currentTarget as HTMLInputElement).value);
}
</script>

<template>
    <input
        v-if="editing"
        ref="field"
        :aria-label="`Label of ${node.data.label}`"
        :value="node.data.label"
        :class="styles.field"
        @focus="($event.currentTarget as HTMLInputElement).select()"
        @keydown="onKeyDown"
        @blur="onBlur"
    />
    <span v-else :class="styles.label">{{ node.data.label }}</span>
</template>
