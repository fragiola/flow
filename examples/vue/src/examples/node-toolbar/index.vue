<script lang="ts">
import type { FlowNodeInput, FlowTypes } from "@fragiola/flow-vue";
import { drag } from "@fragiola/flow-vue/drag";
import { selection } from "@fragiola/flow-vue/selection";

// `Flow.NodeToolbar` stands next to its node, outside the zoom: it keeps its size whatever the
// zoom, and shows while its node is selected (or as `open` says). Its buttons run commands:
// duplicate (`node.add` with a new id), recolour (`node.set-data`) and delete (`node.remove`), in toolbar.vue.

export const TONES = ["blue", "green", "orange", "purple"] as const;
export type Tone = (typeof TONES)[number];

export interface Types extends FlowTypes {
    readonly nodes: { sticky: { text: string; tone: Tone } };
}

export const features = [selection(), drag()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "idea",
        type: "sticky",
        position: { x: 0, y: 0 },
        selected: true,
        data: { text: "Select a note", tone: "blue" },
    },
    {
        id: "todo",
        type: "sticky",
        position: { x: 220, y: 60 },
        data: { text: "Then use its toolbar", tone: "orange" },
    },
];
</script>

<script setup lang="ts">
import { typedFlow } from "@fragiola/flow-vue";
import { styles } from "./styles";
import Toolbar from "./toolbar.vue";

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
                <Flow.Node :node="node" :class="styles.sticky(node.data.tone)">
                    {{ node.data.text }}
                    <Toolbar :node="node" />
                </Flow.Node>
            </Flow.Nodes>
        </Flow.Viewport>
    </Flow.Root>
</template>
