<script lang="ts">
import type { CSSProperties } from "vue";
import type { Side } from "./rotation";

/** Where a handle sits on the node's unturned content: the middle of its side. */
const PLACE: Record<Side, CSSProperties> = {
    top: { top: 0, left: "50%", transform: "translate(-50%, -50%)" },
    right: { top: "50%", left: "100%", transform: "translate(-50%, -50%)" },
    bottom: { top: "100%", left: "50%", transform: "translate(-50%, -50%)" },
    left: { top: "50%", left: 0, transform: "translate(-50%, -50%)" },
};
</script>

<script setup lang="ts">
import { Flow } from "@fragiola/flow-vue";
import {
    NodeResizer,
    RESIZE_POSITIONS,
    ResizeHandle,
} from "@fragiola/flow-vue/resize";
import { computed, ref } from "vue";
import type { Node } from "./index.vue";
import { rotatedSide } from "./rotation";
import RotateHandle from "./rotate-handle.vue";
import ShapeLabel from "./shape-label.vue";
import ShapePicker from "./shape-picker.vue";
import { shapePath } from "./shape-path";
import { styles } from "./styles";

// A node's content: its shape's outline, its label, the rotation knob and the two handles, all
// turned by the node's angle; then its resizer and its toolbar, which do not turn.

const props = defineProps<{ node: Node; editing: boolean }>();
const emit = defineEmits<{ editing: [on: boolean] }>();

const frame = ref<HTMLDivElement | null>(null);
const width = computed(() => props.node.width ?? 140);
const height = computed(() => props.node.height ?? 64);
</script>

<template>
    <div
        ref="frame"
        :data-shape="node.data.shape"
        :data-angle="node.data.angle"
        :style="{ transform: `rotate(${node.data.angle}deg)` }"
        :class="styles.frame"
    >
        <svg :viewBox="`0 0 ${width} ${height}`" aria-hidden="true" :class="styles.svg">
            <path
                :d="shapePath(node.data.shape, width, height, 1.5)"
                :class="styles.outline"
            />
        </svg>
        <ShapeLabel
            :node="node"
            :editing="editing"
            @editing="(on) => emit('editing', on)"
        />
        <RotateHandle :node="node" :frame="() => frame" />
        <!-- remounted on a turn: measured again where the turn put it -->
        <Flow.Handle
            :key="`in-${node.data.angle}`"
            type="target"
            :side="rotatedSide('top', node.data.angle)"
            :aria-label="`${node.data.label} input`"
            :style="PLACE.top"
            :class="styles.handle"
        />
        <Flow.Handle
            :key="`out-${node.data.angle}`"
            type="source"
            :side="rotatedSide('bottom', node.data.angle)"
            :aria-label="`${node.data.label} output`"
            :style="PLACE.bottom"
            :class="styles.handle"
        />
    </div>
    <NodeResizer :class="styles.resizer">
        <ResizeHandle
            v-for="position in RESIZE_POSITIONS"
            :key="position"
            :position="position"
            :aria-label="`Resize ${node.data.label}: ${position}`"
            :class="styles.resizeHandle"
        />
    </NodeResizer>
    <ShapePicker :node="node" @edit="emit('editing', true)" />
</template>
