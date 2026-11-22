<script setup lang="ts">
import { useFlow } from "@fragiola/flow-vue";
import { MinusIcon, PlusIcon } from "@lucide/vue";
import type { features, Node, Types } from "./index.vue";
import { styles } from "./styles";

// A number's value, with its steppers: `node.set-data` from the model.

const props = defineProps<{ node: Extract<Node, { type: "number" }> }>();

const { model } = useFlow<Types, typeof features>();

function step(by: number) {
    model.run("node.set-data", {
        nodeId: props.node.id,
        data: { value: props.node.data.value + by },
    });
}
</script>

<template>
    <div :class="styles.row">
        <span :class="styles.title">{{ node.data.label }}</span>
        <button
            type="button"
            :aria-label="`Decrease ${node.data.label}`"
            :class="styles.step"
            @click="step(-1)"
        >
            <MinusIcon />
        </button>
        <output :data-testid="`value-${node.id}`" :class="styles.value">
            {{ node.data.value }}
        </output>
        <button
            type="button"
            :aria-label="`Increase ${node.data.label}`"
            :class="styles.step"
            @click="step(1)"
        >
            <PlusIcon />
        </button>
    </div>
</template>
