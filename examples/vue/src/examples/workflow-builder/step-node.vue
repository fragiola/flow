<script lang="ts">
import { typedFlow, useEdges } from "@fragiola/flow-vue";
import { iconOf, summaryOf, TYPE_LABELS } from "./catalog";
import { issuesOf } from "./rules";
import { styles } from "./styles";
import type { Step, Types } from "./types";

// One step's card: its type's icon and palette, its title and summary, a mark when it has issues,
// and its ports. Every step but a trigger has an input on top; a condition has a "yes" and a "no"
// output, the others one output below.

/** A condition's two outputs, and where each sits along its bottom side. */
const BRANCHES = [
    { branch: "yes", left: "30%" },
    { branch: "no", left: "70%" },
] as const;

const Flow = typedFlow<Types>();
</script>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ step: Step }>();

// the edges, read with a composable: the mark follows every connection made or removed
const edges = useEdges<Types>();
const issues = computed(() => issuesOf(props.step, edges.value));
const icon = computed(() => iconOf(props.step));
</script>

<template>
    <Flow.Node
        :node="step"
        role="group"
        aria-roledescription="step"
        :aria-label="`${TYPE_LABELS[step.type]}: ${step.data.title}`"
        :class="styles.step"
    >
        <span :class="styles.stepIcon(step.type)">
            <component :is="icon" />
        </span>
        <span :class="styles.stepText">
            <span :class="styles.stepType">{{ TYPE_LABELS[step.type] }}</span>
            <span :class="styles.stepTitle">{{ step.data.title }}</span>
            <span :class="styles.stepSummary">{{ summaryOf(step) }}</span>
        </span>
        <span
            v-if="issues.length > 0"
            role="img"
            :aria-label="`${issues.length} issue${issues.length > 1 ? 's' : ''}`"
            :title="issues.join(' ')"
            :class="styles.issueMark"
        >
            {{ issues.length }}
        </span>
        <Flow.Handle
            v-if="step.type !== 'trigger'"
            type="target"
            side="top"
            handle-id="in"
            :aria-label="`${step.data.title} input`"
            :class="styles.port"
        />
        <template v-if="step.type === 'condition'">
            <Flow.Handle
                v-for="{ branch, left } in BRANCHES"
                :key="branch"
                type="source"
                side="bottom"
                :handle-id="branch"
                :title="branch"
                :aria-label="`${step.data.title} output: ${branch}`"
                :class="styles.branchPort(branch)"
                :style="{ left }"
            />
        </template>
        <Flow.Handle
            v-else
            type="source"
            side="bottom"
            handle-id="out"
            :aria-label="`${step.data.title} output`"
            :class="styles.port"
        />
    </Flow.Node>
</template>
