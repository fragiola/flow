<script lang="ts">
import {
    type FlowEdge,
    type FlowJson,
    type FlowTypes,
    type Middleware,
    veto,
} from "@fragiola/flow-vue";
import { connection } from "@fragiola/flow-vue/connection";
import { drag } from "@fragiola/flow-vue/drag";
import { selection } from "@fragiola/flow-vue/selection";

// Connection rules are middleware, not a callback: `model.use` sees every `edge.add`, from a drag
// or from code, and vetoes what it refuses. While a connection is drawn, the engine asks the model
// (`model.can("edge.add", …)`), so a refused handle is marked `data-invalid` before the drop and the
// drop adds nothing. The rules: a port joins a port of its own type, no cycle, one edge per input.

export type Port = "number" | "text";

export const PORTS: Port[] = ["number", "text"];

export interface Types extends FlowTypes {
    readonly nodes: {
        block: { label: string; inputs: Port[]; outputs: Port[] };
    };
}

export const features = [selection(), drag(), connection()] as const;

/** A handle id says its port's type: `number-0`, `text-1`. */
const portType = (handleId: string | undefined) =>
    handleId?.split("-")[0] as Port | undefined;

/** Whether `to` reaches `from` already: an edge from `from` to `to` would close a cycle. */
function reaches(
    edges: readonly FlowEdge<Types>[],
    to: string,
    from: string,
): boolean {
    const seen = new Set<string>();
    const queue = [to];
    while (queue.length > 0) {
        const id = queue.shift() as string;
        if (id === from) return true;
        if (seen.has(id)) continue;
        seen.add(id);
        for (const edge of edges)
            if (edge.source === id) queue.push(edge.target);
    }
    return false;
}

/** The rules, as a middleware: anything it returns without calling `next` is a veto. */
const connectionRules: Middleware<Types, typeof features> = (ctx, next) => {
    if (ctx.command !== "edge.add") return next();
    const { source, target, sourceHandle, targetHandle } = ctx.payload;
    if (portType(sourceHandle) !== portType(targetHandle)) {
        return veto("a port only joins a port of its own type");
    }
    if (source === target || reaches(ctx.state.edges, target, source)) {
        return veto("that edge would close a cycle");
    }
    const taken = ctx.state.edges.some(
        (edge) => edge.target === target && edge.targetHandle === targetHandle,
    );
    if (taken) return veto("that input already has an edge");
    return next();
};

const json: FlowJson<Types> = {
    version: 1,
    nodes: [
        {
            id: "count",
            type: "block",
            position: { x: 0, y: 0 },
            data: { label: "Count", inputs: [], outputs: ["number"] },
        },
        {
            id: "name",
            type: "block",
            position: { x: 0, y: 160 },
            data: { label: "Name", inputs: [], outputs: ["text"] },
        },
        {
            id: "format",
            type: "block",
            position: { x: 260, y: 60 },
            data: {
                label: "Format",
                inputs: ["number", "text"],
                outputs: ["text"],
            },
        },
        {
            id: "print",
            type: "block",
            position: { x: 520, y: 90 },
            data: { label: "Print", inputs: ["text"], outputs: ["text"] },
        },
    ],
    edges: [
        {
            id: "count-format",
            source: "count",
            target: "format",
            sourceHandle: "number-0",
            targetHandle: "number-0",
        },
    ],
};
</script>

<script setup lang="ts">
import { createFlowModel, typedFlow } from "@fragiola/flow-vue";
import FlowOutcome from "./flow-outcome.vue";
import { styles } from "./styles";

const Flow = typedFlow<Types, typeof features>();

// the model is made once, with its middleware, and handed to the root
const model = createFlowModel<Types, typeof features>(json, { features });
model.use(connectionRules);

/** Where the i-th of `count` ports sits on its side. */
const portTop = (index: number, count: number) =>
    `${((index + 1) * 100) / (count + 1)}%`;
</script>

<template>
    <Flow.Root
        :model="model"
        :fit-view="{ padding: 0.2, maxZoom: 1 }"
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
                    <span :class="styles.title">{{ node.data.label }}</span>
                    <Flow.Handle
                        v-for="(port, index) in node.data.inputs"
                        :key="`in-${port}`"
                        type="target"
                        side="left"
                        :handle-id="`${port}-${index}`"
                        :title="`${port} input`"
                        :class="styles.port(port)"
                        :style="{ top: portTop(index, node.data.inputs.length) }"
                    />
                    <Flow.Handle
                        v-for="(port, index) in node.data.outputs"
                        :key="`out-${port}`"
                        type="source"
                        side="right"
                        :handle-id="`${port}-${index}`"
                        :title="`${port} output`"
                        :class="styles.port(port)"
                        :style="{ top: portTop(index, node.data.outputs.length) }"
                    />
                </Flow.Node>
            </Flow.Nodes>
            <Flow.ConnectionLine :class="styles.connection" />
        </Flow.Viewport>
        <FlowOutcome />
    </Flow.Root>
</template>
