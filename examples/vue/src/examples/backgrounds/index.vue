<script lang="ts">
import type {
    BackgroundVariant,
    FlowNodeInput,
    FlowTypes,
} from "@fragiola/flow-vue";
import { drag } from "@fragiola/flow-vue/drag";

// `Flow.Background` draws one SVG pattern that pans and zooms with the flow: `dots`, `lines` or
// `cross`, every `gap` flow units, its marks `size` units big, in `currentColor`. Two backgrounds
// layer: here a coarse grid of lines every five cells over the chosen pattern.

interface Types extends FlowTypes {
    readonly nodes: { card: { label: string } };
}

const features = [drag()] as const;

const VARIANTS: { value: BackgroundVariant; label: string }[] = [
    { value: "dots", label: "Dots" },
    { value: "lines", label: "Lines" },
    { value: "cross", label: "Cross" },
];

const GAPS = [16, 24, 40];

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "a",
        type: "card",
        position: { x: 0, y: 0 },
        data: { label: "Drag me" },
    },
    {
        id: "b",
        type: "card",
        position: { x: 240, y: 120 },
        data: { label: "Zoom out" },
    },
];
</script>

<script setup lang="ts">
import { typedFlow } from "@fragiola/flow-vue";
import { ref } from "vue";
import { styles } from "./styles";

const Flow = typedFlow<Types, typeof features>();

const variant = ref<BackgroundVariant>("dots");
const gap = ref(24);
const coarse = ref(true);
</script>

<template>
    <div :class="styles.layout">
        <div role="toolbar" aria-label="Background" :class="styles.toolbar">
            <fieldset :class="styles.group">
                <legend :class="styles.legend">Pattern</legend>
                <button
                    v-for="option in VARIANTS"
                    :key="option.value"
                    type="button"
                    :aria-pressed="variant === option.value"
                    :class="styles.segment"
                    @click="variant = option.value"
                >
                    {{ option.label }}
                </button>
            </fieldset>
            <fieldset :class="styles.group">
                <legend :class="styles.legend">Gap</legend>
                <button
                    v-for="value in GAPS"
                    :key="value"
                    type="button"
                    :aria-pressed="gap === value"
                    :class="styles.segment"
                    @click="gap = value"
                >
                    {{ value }}
                </button>
            </fieldset>
            <label :class="styles.check">
                <input v-model="coarse" type="checkbox" />
                Coarse grid
            </label>
        </div>
        <Flow.Root
            :features="features"
            :default-nodes="nodes"
            :fit-view="{ padding: 0.2, maxZoom: 1 }"
            :class="styles.root"
        >
            <Flow.Background
                data-testid="pattern"
                :variant="variant"
                :gap="gap"
                :size="variant === 'dots' ? 2.5 : variant === 'cross' ? 8 : 1"
                :class="styles.pattern"
            />
            <Flow.Background
                v-if="coarse"
                data-testid="coarse-grid"
                variant="lines"
                :gap="gap * 5"
                :size="1.5"
                :class="styles.coarse"
            />
            <Flow.Viewport>
                <Flow.Nodes v-slot="{ node }">
                    <Flow.Node :node="node" :class="styles.node">
                        {{ node.data.label }}
                    </Flow.Node>
                </Flow.Nodes>
            </Flow.Viewport>
        </Flow.Root>
    </div>
</template>
