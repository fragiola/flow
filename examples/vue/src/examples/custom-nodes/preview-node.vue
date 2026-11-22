<script setup lang="ts">
import { Flow, useEdges, useNodes } from "@fragiola/flow-vue";
import { computed } from "vue";
import type { Node, Types } from "./index.vue";
import { styles } from "./styles";

// The preview: it reads the nodes wired into its two target handles, and drags by its title bar.

const props = defineProps<{ node: Extract<Node, { type: "preview" }> }>();

const edges = useEdges<Types>();
const nodes = useNodes<Types>();

/** The value wired into one of the preview's handles: the source node's data, if any. */
function inputOf(handleId: string): Node | undefined {
    const edge = edges.value.find(
        (e) => e.target === props.node.id && e.targetHandle === handleId,
    );
    return nodes.value.find((n) => n.id === edge?.source);
}

const fill = computed(() => {
    const colour = inputOf("colour");
    return colour?.type === "colour" ? colour.data.colour : undefined;
});
const side = computed(() => {
    const size = inputOf("size");
    return size?.type === "number" ? size.data.value : 32;
});
</script>

<template>
    <div data-flow-drag-handle :class="styles.dragHandle">
        <span :class="styles.caption">{{ node.data.label }}</span>
        <span aria-hidden="true" :class="styles.grip" />
    </div>
    <div :class="styles.stage">
        <div
            v-if="fill"
            role="img"
            :aria-label="`A ${side} pixel swatch of ${fill}`"
            :class="styles.swatch"
            :style="{ background: fill, width: `${side}px`, height: `${side}px` }"
        />
        <span v-else :class="styles.empty">Connect a colour</span>
    </div>
    <Flow.Handle
        type="target"
        side="left"
        handle-id="colour"
        :class="styles.handle"
        :style="{ top: '35%' }"
    />
    <Flow.Handle
        type="target"
        side="left"
        handle-id="size"
        :class="styles.handle"
        :style="{ top: '75%' }"
    />
</template>
