<script lang="ts">
import type { FlowNodeInput, FlowTypes } from "@fragiola/flow-vue";
import { drag } from "@fragiola/flow-vue/drag";
import { keyboard } from "@fragiola/flow-vue/keyboard";
import { resize } from "@fragiola/flow-vue/resize";
import { selection } from "@fragiola/flow-vue/selection";

// `resize()` and `NodeResizer`: a handle on each corner and side of the node; dragging one resizes
// the node (`node.resize`, its `width` and `height` written to the document). Each resizer has its
// own limits over the feature's; the photo keeps its aspect ratio. The handles show while the node
// is selected (a style on the node's `data-selected`). With `keyboard()` each handle takes focus:
// Tab to one and use the arrows (Shift for a bigger step); each has its own name, the default
// handles have none.

interface Types extends FlowTypes {
    readonly nodes: {
        note: { label: string; text: string; limits: string };
        photo: { label: string };
    };
}

const features = [
    selection(),
    drag(),
    resize({ minWidth: 80, minHeight: 60 }),
    keyboard(),
] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "note",
        type: "note",
        position: { x: 0, y: 0 },
        width: 200,
        height: 120,
        selected: true,
        data: {
            label: "Note",
            text: "Resize me from any corner or side.",
            limits: "120–360 × 80–240",
        },
    },
    {
        id: "photo",
        type: "photo",
        position: { x: 260, y: 0 },
        width: 160,
        height: 120,
        data: { label: "Photo (4:3, keeps its ratio)" },
    },
];
</script>

<script setup lang="ts">
import { typedFlow } from "@fragiola/flow-vue";
import {
    NodeResizer,
    RESIZE_POSITIONS,
    ResizeHandle,
} from "@fragiola/flow-vue/resize";
import { styles } from "./styles";

const Flow = typedFlow<Types, typeof features>();
</script>

<template>
    <Flow.Root
        :features="features"
        :default-nodes="nodes"
        :fit-view="{ padding: 0.2, maxZoom: 1 }"
        :class="styles.root"
    >
        <Flow.Background variant="dots" :size="2" :class="styles.dots" />
        <Flow.Background variant="lines" :class="styles.lines" />
        <Flow.Background variant="cross" :class="styles.cross" />
        <Flow.Viewport>
            <Flow.Nodes v-slot="{ node }">
                <Flow.Node :node="node" :aria-label="node.data.label" :class="styles.node">
                    <span :class="styles.title">{{ node.data.label }}</span>
                    <template v-if="node.type === 'note'">
                        <p :class="styles.text">{{ node.data.text }}</p>
                        <span :class="styles.limits">{{ node.data.limits }}</span>
                        <NodeResizer
                            :min-width="120"
                            :max-width="360"
                            :min-height="80"
                            :max-height="240"
                            :class="styles.resizer"
                        >
                            <ResizeHandle
                                v-for="position in RESIZE_POSITIONS"
                                :key="position"
                                :position="position"
                                :aria-label="`Resize ${node.id}: ${position}`"
                                :class="styles.resizeHandle"
                            />
                        </NodeResizer>
                    </template>
                    <template v-else>
                        <div
                            role="img"
                            aria-label="A placeholder photo"
                            :class="styles.photo"
                        />
                        <NodeResizer keep-aspect-ratio :class="styles.resizer">
                            <ResizeHandle
                                v-for="position in RESIZE_POSITIONS"
                                :key="position"
                                :position="position"
                                :aria-label="`Resize ${node.id}: ${position}`"
                                :class="styles.resizeHandle"
                            />
                        </NodeResizer>
                    </template>
                </Flow.Node>
            </Flow.Nodes>
        </Flow.Viewport>
    </Flow.Root>
</template>
