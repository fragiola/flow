<script setup lang="ts">
import {
    EraserIcon,
    LassoIcon,
    MousePointer2Icon,
    PencilIcon,
    SquareIcon,
} from "@lucide/vue";
import type { Tool } from "./index.vue";
import { styles } from "./styles";

// The tools, one pressed: a toolbar of toggle buttons, with the active tool's hint and the status.

defineProps<{ tool: Tool; status: string }>();
const emit = defineEmits<{ tool: [tool: Tool] }>();

const TOOLS = [
    { tool: "select", label: "Select", icon: MousePointer2Icon },
    { tool: "rectangle", label: "Rectangle", icon: SquareIcon },
    { tool: "freehand", label: "Freehand", icon: PencilIcon },
    { tool: "eraser", label: "Eraser", icon: EraserIcon },
    { tool: "lasso", label: "Lasso", icon: LassoIcon },
] as const satisfies readonly {
    tool: Tool;
    label: string;
    icon: unknown;
}[];

const HINTS: Record<Tool, string> = {
    select: "Drag the pane to pan, a node to move it.",
    rectangle: "Drag on the board to draw a rectangle.",
    freehand: "Draw with the pointer.",
    eraser: "Wipe over nodes and edges to erase them.",
    lasso: "Draw around nodes to select them.",
};
</script>

<template>
    <div :class="styles.panel">
        <div role="toolbar" aria-label="Whiteboard tools" :class="styles.tools">
            <button
                v-for="each in TOOLS"
                :key="each.tool"
                type="button"
                :aria-label="each.label"
                :aria-pressed="tool === each.tool"
                :title="each.label"
                :class="styles.tool"
                @click="emit('tool', each.tool)"
            >
                <component :is="each.icon" />
            </button>
        </div>
        <p :class="styles.hint">{{ HINTS[tool] }}</p>
        <p role="status" :class="styles.status">{{ status }}</p>
    </div>
</template>
