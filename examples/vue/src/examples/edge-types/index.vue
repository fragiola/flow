<script lang="ts">
import type {
    FlowEdgeInput,
    FlowNodeInput,
    FlowTypes,
} from "@fragiola/flow-vue";
import { drag } from "@fragiola/flow-vue/drag";
import { selection } from "@fragiola/flow-vue/selection";

// The edge's `type` picks its path: the core draws `bezier` (the default), `simplebezier` (one
// curve, its control points halfway on each end's axis), `smoothstep`, `step` and `straight`. Any
// other type is the app's: `Flow.EdgePath` takes a `d` of your own, drawn here from the edge's ends
// (`useEdge(edge).state.path`) as a wave (wave-edge.vue). An edge's own `pathOptions` shape it over
// the root's (the step turns a quarter of the way down, the smooth step's corners are rounder), and
// `animated` marks it `data-animated` for its style (the smooth step pulses). Drag the nodes to see
// each path follow.

export interface Types extends FlowTypes {
    readonly nodes: { point: { label: string } };
    readonly edges: { wave: { amplitude: number } };
}

export const features = [selection(), drag()] as const;

const TYPES = ["bezier", "simplebezier", "smoothstep", "step", "straight", "wave"] as const;

/** What some edges set of their own: their path's shape, and an animated one. */
const EDGE_OPTIONS: Partial<Record<(typeof TYPES)[number], Partial<FlowEdgeInput<Types>>>> = {
    step: { pathOptions: { stepPosition: 0.25 } },
    smoothstep: { animated: true, pathOptions: { borderRadius: 16 } },
};

const nodes: FlowNodeInput<Types>[] = TYPES.flatMap((type, index) => [
    {
        id: `${type}-a`,
        type: "point",
        position: { x: index * 170, y: 0 },
        data: { label: "Source" },
    },
    {
        id: `${type}-b`,
        type: "point",
        position: { x: index * 170 + 60, y: 200 },
        data: { label: "Target" },
    },
]);

const edges: FlowEdgeInput<Types>[] = TYPES.map((type) =>
    type === "wave"
        ? {
              id: type,
              source: `${type}-a`,
              target: `${type}-b`,
              type,
              data: { amplitude: 10 },
          }
        : {
              id: type,
              source: `${type}-a`,
              target: `${type}-b`,
              type,
              ...EDGE_OPTIONS[type],
          },
);
</script>

<script setup lang="ts">
import { typedFlow } from "@fragiola/flow-vue";
import { styles } from "./styles";
import WaveEdge from "./wave-edge.vue";

const Flow = typedFlow<Types, typeof features>();
</script>

<template>
    <Flow.Root
        :features="features"
        :default-nodes="nodes"
        :default-edges="edges"
        :fit-view="{ padding: 0.15 }"
        :class="styles.root"
    >
        <Flow.Background variant="dots" :size="2" :class="styles.dots" />
        <Flow.Background variant="lines" :class="styles.lines" />
        <Flow.Background variant="cross" :class="styles.cross" />
        <Flow.Viewport>
            <Flow.Edges v-slot="{ edge }">
                <WaveEdge v-if="edge.type === 'wave'" :edge="edge" />
                <Flow.Edge v-else :edge="edge">
                    <Flow.EdgePath :class="styles.edge" />
                    <Flow.EdgeLabel :class="styles.label">
                        {{ edge.type ?? "bezier" }}
                    </Flow.EdgeLabel>
                </Flow.Edge>
            </Flow.Edges>
            <Flow.Nodes v-slot="{ node }">
                <Flow.Node :node="node" :class="styles.node">
                    {{ node.data.label }}
                    <Flow.Handle type="target" side="top" :class="styles.handle" />
                    <Flow.Handle type="source" side="bottom" :class="styles.handle" />
                </Flow.Node>
            </Flow.Nodes>
        </Flow.Viewport>
    </Flow.Root>
</template>
