<script lang="ts">
import type {
    FlowEdgeInput,
    FlowNodeInput,
    FlowTypes,
} from "@fragiola/flow-vue";
import { drag } from "@fragiola/flow-vue/drag";
import { minimap } from "@fragiola/flow-vue/minimap";
import { selection } from "@fragiola/flow-vue/selection";

// `minimap()` draws the whole flow small (`MiniMap`): a `MiniMapNode` per node and a `MiniMapMask`
// over what the root does not show; dragging in it pans the flow, the wheel over it zooms.
// `Flow.Controls` groups the buttons; each runs one engine action and is disabled while the engine
// refuses it (at the zoom limits). The lock (`Flow.ToggleInteractive`) stops every gesture that
// changes the flow; pan and zoom stay. Its default slot gets its state: the icon follows the lock.

interface Types extends FlowTypes {
    readonly nodes: { city: { label: string } };
}

const features = [selection(), drag(), minimap()] as const;

const CITIES = [
    ["lisbon", "Lisbon", -500, 300],
    ["madrid", "Madrid", -300, 260],
    ["paris", "Paris", -120, -40],
    ["london", "London", -220, -240],
    ["amsterdam", "Amsterdam", 60, -230],
    ["berlin", "Berlin", 300, -170],
    ["prague", "Prague", 320, 30],
    ["vienna", "Vienna", 460, 160],
    ["rome", "Rome", 220, 420],
    ["milan", "Milan", 40, 200],
] as const;

const nodes: FlowNodeInput<Types>[] = CITIES.map(([id, label, x, y]) => ({
    id,
    type: "city",
    position: { x, y },
    data: { label },
}));

const ROUTE = [
    "lisbon",
    "madrid",
    "paris",
    "london",
    "amsterdam",
    "berlin",
    "prague",
    "vienna",
    "rome",
    "milan",
    "paris",
];

const edges: FlowEdgeInput<Types>[] = ROUTE.slice(1).map((target, index) => ({
    id: `${ROUTE[index]}-${target}`,
    source: ROUTE[index] as string,
    target,
    type: "straight",
}));
</script>

<script setup lang="ts">
import { typedFlow } from "@fragiola/flow-vue";
import { MiniMap, MiniMapMask, MiniMapNode } from "@fragiola/flow-vue/minimap";
import {
    LockIcon,
    MaximizeIcon,
    MinusIcon,
    PlusIcon,
    UnlockIcon,
} from "@lucide/vue";
import { styles } from "./styles";

const Flow = typedFlow<Types, typeof features>();
</script>

<template>
    <Flow.Root
        :features="features"
        :default-nodes="nodes"
        :default-edges="edges"
        :fit-view="{ padding: 0.1 }"
        :min-zoom="0.25"
        :max-zoom="2"
        :class="styles.root"
    >
        <Flow.Background variant="dots" :size="2" :class="styles.dots" />
        <Flow.Background variant="lines" :class="styles.lines" />
        <Flow.Background variant="cross" :class="styles.cross" />
        <Flow.Viewport>
            <Flow.Edges v-slot="{ edge }">
                <Flow.Edge :edge="edge">
                    <Flow.EdgePath :class="styles.edge" />
                </Flow.Edge>
            </Flow.Edges>
            <Flow.Nodes v-slot="{ node }">
                <Flow.Node :node="node" :class="styles.node">
                    {{ node.data.label }}
                    <Flow.Handle type="target" side="top" :class="styles.anchor" />
                    <Flow.Handle type="source" side="bottom" :class="styles.anchor" />
                </Flow.Node>
            </Flow.Nodes>
        </Flow.Viewport>
        <Flow.Controls
            role="group"
            aria-label="Zoom and lock"
            :class="styles.controls"
        >
            <Flow.ZoomIn aria-label="Zoom in" :class="styles.control">
                <PlusIcon />
            </Flow.ZoomIn>
            <Flow.ZoomOut aria-label="Zoom out" :class="styles.control">
                <MinusIcon />
            </Flow.ZoomOut>
            <Flow.FitView aria-label="Fit view" :class="styles.control">
                <MaximizeIcon />
            </Flow.FitView>
            <Flow.ToggleInteractive
                v-slot="{ state }"
                aria-label="Lock the flow"
                :class="styles.control"
            >
                <UnlockIcon v-if="state.interactive" />
                <LockIcon v-else />
            </Flow.ToggleInteractive>
        </Flow.Controls>
        <MiniMap
            v-slot="{ view }"
            :width="180"
            :height="130"
            role="img"
            aria-label="Minimap of the route"
            :class="styles.minimap"
        >
            <MiniMapNode
                v-for="node in view.nodes"
                :key="node.nodeId"
                :node-id="node.nodeId"
                :class="styles.minimapNode"
            />
            <MiniMapMask :class="styles.minimapMask" />
        </MiniMap>
    </Flow.Root>
</template>
