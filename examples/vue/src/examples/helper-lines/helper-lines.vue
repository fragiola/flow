<script setup lang="ts">
import { useFlowStore } from "@fragiola/flow-vue";
import { type Guide, guidesOf, sameGuides } from "./alignment";
import { type features, OVERHANG, type Types } from "./index.vue";
import { boxOf, othersOf } from "./snapping";
import { styles } from "./styles";

// The guides of the node being dragged alone, in flow coordinates inside the viewport: a vertical
// line (`data-axis="x"`) where an x lines up, a horizontal one (`data-axis="y"`) where a y does.

const NONE: Guide[] = [];

const guides = useFlowStore<Guide[], Types, typeof features>(
    ({ model, engine }) => {
        const dragging = engine.get("dragging-node-ids");
        const nodeId = dragging.length === 1 ? dragging[0] : undefined;
        if (nodeId === undefined) return NONE;
        const node = model.get("node-by", { id: nodeId });
        if (!node || node.parentId !== undefined) return NONE;
        return guidesOf(boxOf(node), othersOf(model.get("all-nodes"), nodeId));
    },
    sameGuides,
);

/** A guide's ends, past the boxes it joins by `OVERHANG`. */
function ends(guide: Guide) {
    const from = guide.from - OVERHANG;
    const to = guide.to + OVERHANG;
    return guide.axis === "x"
        ? { x1: guide.at, y1: from, x2: guide.at, y2: to }
        : { x1: from, y1: guide.at, x2: to, y2: guide.at };
}
</script>

<template>
    <svg v-if="guides.length > 0" aria-hidden="true" :class="styles.overlay">
        <line
            v-for="guide in guides"
            :key="`${guide.axis}-${guide.at}`"
            data-testid="guide"
            :data-axis="guide.axis"
            :data-at="guide.at"
            v-bind="ends(guide)"
            :class="styles.guide"
        />
    </svg>
</template>
