<script lang="ts">
import type { FlowModel } from "@fragiola/flow-vue";
import { CircleAlertIcon, CircleCheckIcon, Trash2Icon } from "@lucide/vue";
import { Input } from "#/components/atoms/fields";
import { Field } from "#/components/ui/field";
import { Select } from "#/components/ui/select";
import { TYPE_LABELS } from "./catalog";
import { issuesOf } from "./rules";
import { styles } from "./styles";
import type { TriggerKind, Types } from "./types";
import { useWorkflow } from "./use-workflow";

// The side panel: the selected step's settings (each field runs `node.set-data`), or, with nothing
// selected, the workflow's summary and every issue left. It sits beside the root and reads the
// model it is given.

const TRIGGERS: Record<TriggerKind, string> = {
    webhook: "Webhook",
    schedule: "Schedule",
    form: "Form submitted",
};
</script>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ model: FlowModel<Types> }>();

const { steps, edges } = useWorkflow(props.model);
const step = computed(() => {
    const selected = steps.value.filter((s) => s.selected === true);
    return selected.length === 1 ? selected[0] : undefined;
});
const issues = computed(() =>
    step.value
        ? issuesOf(step.value, edges.value)
        : steps.value.flatMap((s) =>
              issuesOf(s, edges.value).map(
                  (issue) => `${s.data.title}: ${issue}`,
              ),
          ),
);

function set(data: Record<string, unknown>) {
    if (step.value) {
        props.model.run("node.set-data", { nodeId: step.value.id, data });
    }
}

function remove() {
    if (step.value) props.model.run("node.remove", { nodeId: step.value.id });
}
</script>

<template>
    <aside aria-label="Inspector" :class="styles.inspector">
        <div :class="styles.inspectorHeader">
            <h2 :class="styles.inspectorTitle">
                {{ step ? `${TYPE_LABELS[step.type]} settings` : "Workflow" }}
            </h2>
            <button
                v-if="step"
                type="button"
                aria-label="Delete step"
                :class="styles.iconButton"
                @click="remove"
            >
                <Trash2Icon />
            </button>
        </div>
        <div v-if="step" :key="step.id" :class="styles.fields">
            <Field.Root>
                <Field.Label>Name</Field.Label>
                <Field.Row>
                    <Field.Body>
                        <Input
                            :model-value="step.data.title"
                            @update:model-value="set({ title: $event })"
                        />
                    </Field.Body>
                </Field.Row>
            </Field.Root>
            <Field.Root v-if="step.type === 'trigger'">
                <Field.Label>Starts on</Field.Label>
                <Select.Root
                    :model-value="step.data.kind"
                    @update:model-value="set({ kind: $event })"
                >
                    <Select.Trigger>
                        <Select.Value>{{ TRIGGERS[step.data.kind] }}</Select.Value>
                    </Select.Trigger>
                    <Select.Content>
                        <Select.Item
                            v-for="(label, value) in TRIGGERS"
                            :key="value"
                            :value="value"
                        >
                            {{ label }}
                        </Select.Item>
                    </Select.Content>
                </Select.Root>
            </Field.Root>
            <Field.Root v-if="step.type === 'trigger' || step.type === 'action'">
                <Field.Label>
                    {{ step.type === "trigger" ? "Source" : "Target" }}
                </Field.Label>
                <Field.Row>
                    <Field.Body>
                        <Input
                            :model-value="step.data.detail"
                            @update:model-value="set({ detail: $event })"
                        />
                    </Field.Body>
                </Field.Row>
            </Field.Root>
            <Field.Root v-if="step.type === 'condition'">
                <Field.Label>Condition</Field.Label>
                <Field.Row>
                    <Field.Body>
                        <Input
                            :model-value="step.data.expression"
                            spellcheck="false"
                            @update:model-value="set({ expression: $event })"
                        />
                    </Field.Body>
                </Field.Row>
            </Field.Root>
            <Field.Root v-if="step.type === 'delay'">
                <Field.Label>Wait (minutes)</Field.Label>
                <Field.Row>
                    <Field.Body>
                        <Input
                            type="number"
                            :min="1"
                            :model-value="step.data.minutes"
                            @update:model-value="
                                set({ minutes: Math.max(1, Number($event) || 1) })
                            "
                        />
                    </Field.Body>
                </Field.Row>
            </Field.Root>
        </div>
        <p v-else :class="styles.muted">
            {{ steps.length }} steps, {{ edges.length }} connections. Select a
            step to edit it.
        </p>
        <div role="status" data-testid="issues" :class="styles.issues">
            <p v-if="issues.length === 0" :class="styles.ok">
                <CircleCheckIcon />
                {{ step ? "This step is ready." : "Ready to publish." }}
            </p>
            <ul v-else :class="styles.issueList">
                <!-- two steps may have the same title and issue: derived, never reordered -->
                <li v-for="(issue, index) in issues" :key="index" :class="styles.issue">
                    <CircleAlertIcon />
                    {{ issue }}
                </li>
            </ul>
        </div>
    </aside>
</template>
