<script lang="ts">
import type { FlowNodeInput, FlowTypes } from "@fragiola/flow-vue";
import { drag } from "@fragiola/flow-vue/drag";
import { selection } from "@fragiola/flow-vue/selection";

// `drag({ snapGrid })` moves a dragged node onto the grid: its top-left corner lands on a multiple
// of the grid (the other dragged nodes keep their offsets). The background draws the same grid
// (`gap`). A feature's options are fixed when the model is made, so another grid size remounts the
// root (`:key`), starting from the nodes as they are now.

interface Types extends FlowTypes {
    readonly nodes: { card: { label: string } };
}

const SIZES = [10, 20, 40];

const initial: FlowNodeInput<Types>[] = [
    {
        id: "a",
        type: "card",
        position: { x: 0, y: 0 },
        data: { label: "Snaps" },
    },
    {
        id: "b",
        type: "card",
        position: { x: 200, y: 80 },
        data: { label: "to the" },
    },
    {
        id: "c",
        type: "card",
        position: { x: 80, y: 200 },
        data: { label: "grid" },
    },
];

/** The features for one grid size: the root reads them once, so another size remounts it. */
const featuresFor = (grid: number) =>
    [selection(), drag({ snapGrid: [grid, grid] })] as const;

type Features = ReturnType<typeof featuresFor>;
</script>

<script setup lang="ts">
import { type FlowNode, typedFlow } from "@fragiola/flow-vue";
import { ref, shallowRef } from "vue";
import { styles } from "./styles";

const Flow = typedFlow<Types, Features>();

const grid = ref(20);
const features = shallowRef(featuresFor(grid.value));
// the nodes as they are now, for the next remount
let nodes: readonly FlowNodeInput<Types>[] = initial;
const keep = (next: readonly FlowNode<Types>[]) => {
    nodes = next;
};
function choose(size: number) {
    features.value = featuresFor(size);
    grid.value = size;
}
</script>

<template>
    <div :class="styles.layout">
        <fieldset :class="styles.toolbar">
            <legend :class="styles.legend">Grid size</legend>
            <button
                v-for="size in SIZES"
                :key="size"
                type="button"
                :aria-pressed="grid === size"
                :class="styles.segment"
                @click="choose(size)"
            >
                {{ size }} px
            </button>
        </fieldset>
        <Flow.Root
            :key="grid"
            :features="features"
            :default-nodes="nodes"
            :fit-view="{ padding: 0.2, maxZoom: 1 }"
            :class="styles.root"
            @update:nodes="keep"
        >
            <Flow.Background variant="dots" :gap="grid" :size="2" :class="styles.dots" />
            <Flow.Background variant="lines" :gap="grid" :class="styles.lines" />
            <Flow.Background variant="cross" :gap="grid" :class="styles.cross" />
            <Flow.Viewport>
                <Flow.Nodes v-slot="{ node }">
                    <Flow.Node :node="node" :class="styles.node">
                        {{ node.data.label }}
                        <span data-testid="position" :class="styles.position">
                            {{ node.position.x }}, {{ node.position.y }}
                        </span>
                    </Flow.Node>
                </Flow.Nodes>
            </Flow.Viewport>
        </Flow.Root>
    </div>
</template>
