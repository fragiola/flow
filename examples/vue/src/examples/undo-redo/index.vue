<script lang="ts">
import type {
    FlowEdgeInput,
    FlowNodeInput,
    FlowTypes,
} from "@fragiola/flow-vue";
import { connection } from "@fragiola/flow-vue/connection";
import { drag } from "@fragiola/flow-vue/drag";
import { keyboard } from "@fragiola/flow-vue/keyboard";
import { selection } from "@fragiola/flow-vue/selection";

// Undo is app policy: `_kit/undo.ts` (copy it) listens to the model and keeps the documents before
// each step. A drag is one step (its transient moves end with a final one), and so is a connection
// or a deletion (Delete removes the selection with its edges, in one command). Selecting is not a
// step. Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z redoes.

interface Types extends FlowTypes {
    readonly nodes: { block: { label: string } };
}

const features = [selection(), drag(), connection(), keyboard()] as const;

const nodes: FlowNodeInput<Types>[] = [
    {
        id: "a",
        type: "block",
        position: { x: 0, y: 0 },
        data: { label: "Drag" },
    },
    {
        id: "b",
        type: "block",
        position: { x: 220, y: 0 },
        data: { label: "Connect" },
    },
    {
        id: "c",
        type: "block",
        position: { x: 110, y: 140 },
        data: { label: "Delete" },
    },
];

const edges: FlowEdgeInput<Types>[] = [{ id: "a-c", source: "a", target: "c" }];
</script>

<script setup lang="ts">
import { createFlowModel, typedFlow } from "@fragiola/flow-vue";
import { Redo2Icon, Undo2Icon } from "@lucide/vue";
import { onMounted, onUnmounted, shallowRef } from "vue";
import {
    createUndoHistory,
    handleUndoKeys,
    type UndoHistory,
    type UndoSnapshot,
} from "../_kit/undo";
import { styles } from "./styles";

const Flow = typedFlow<Types, typeof features>();

// the model is made here, so that the history and the shortcuts sit beside the root
const model = createFlowModel<Types, typeof features>(
    { version: 1, nodes, edges },
    { features },
);
const history = shallowRef<UndoHistory | null>(null);
const snapshot = shallowRef<UndoSnapshot | null>(null);

// the shortcuts, on the window: a Delete leaves the focus on the page, not in the flow (an app
// with other editable content would scope them to its editor)
function onKeyDown(event: KeyboardEvent) {
    if (history.value) handleUndoKeys(history.value, event);
}

let stop = () => {};
onMounted(() => {
    const created = createUndoHistory(model);
    history.value = created;
    snapshot.value = created.getSnapshot();
    const unsubscribe = created.subscribe(() => {
        snapshot.value = created.getSnapshot();
    });
    window.addEventListener("keydown", onKeyDown);
    stop = () => {
        window.removeEventListener("keydown", onKeyDown);
        unsubscribe();
        created.dispose();
    };
});
onUnmounted(() => stop());
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
                <Flow.Edge
                    :edge="edge"
                    role="group"
                    aria-roledescription="edge"
                    :aria-label="`${edge.source} to ${edge.target}`"
                    :class="styles.edgeGroup"
                >
                    <Flow.EdgePath :class="styles.edge" />
                </Flow.Edge>
            </Flow.Edges>
            <Flow.Nodes v-slot="{ node }">
                <Flow.Node
                    :node="node"
                    role="group"
                    aria-roledescription="node"
                    :aria-label="node.data.label"
                    :class="styles.node"
                >
                    {{ node.data.label }}
                    <Flow.Handle
                        type="target"
                        side="top"
                        :aria-label="`${node.data.label} input`"
                        :class="styles.handle"
                    />
                    <Flow.Handle
                        type="source"
                        side="bottom"
                        :aria-label="`${node.data.label} output`"
                        :class="styles.handle"
                    />
                </Flow.Node>
            </Flow.Nodes>
            <Flow.ConnectionLine :class="styles.connection" />
        </Flow.Viewport>
        <div v-if="history && snapshot" :class="styles.panel">
            <div role="toolbar" aria-label="History" :class="styles.buttons">
                <button
                    type="button"
                    aria-label="Undo"
                    :disabled="!snapshot.canUndo"
                    :class="styles.button"
                    @click="history.undo()"
                >
                    <Undo2Icon />
                </button>
                <button
                    type="button"
                    aria-label="Redo"
                    :disabled="!snapshot.canRedo"
                    :class="styles.button"
                    @click="history.redo()"
                >
                    <Redo2Icon />
                </button>
            </div>
            <ol aria-label="Steps" data-testid="steps" :class="styles.steps">
                <!-- the steps are a stack: their index is their key -->
                <li
                    v-for="(step, index) in snapshot.undoSteps"
                    :key="index"
                    :class="styles.step"
                >
                    {{ step }}
                </li>
            </ol>
        </div>
    </Flow.Root>
</template>
