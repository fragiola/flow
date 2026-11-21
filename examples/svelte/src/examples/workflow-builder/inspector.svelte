<script module lang="ts">
    import type { FlowModel } from "@fragiola/flow-svelte";
    import { CircleAlertIcon, CircleCheckIcon, Trash2Icon } from "@lucide/svelte";
    import { Input } from "#/components/atoms/fields";
    import { Field } from "#/components/ui/field";
    import { Select } from "#/components/ui/select";
    import { TYPE_LABELS } from "./catalog";
    import { issuesOf } from "./rules";
    import { styles } from "./styles";
    import type { TriggerKind, Types } from "./types";
    import { useWorkflow } from "./use-workflow.svelte";

    // The side panel: the selected step's settings (each field runs `node.set-data`), or, with
    // nothing selected, the workflow's summary and every issue left. It sits beside the root and
    // reads the model it is given.

    const TRIGGERS: Record<TriggerKind, string> = {
        webhook: "Webhook",
        schedule: "Schedule",
        form: "Form submitted",
    };
</script>

<script lang="ts">
    let { model }: { model: FlowModel<Types> } = $props();

    const workflow = useWorkflow(() => model);
    const step = $derived.by(() => {
        const selected = workflow.steps.filter((s) => s.selected === true);
        return selected.length === 1 ? selected[0] : undefined;
    });
    const issues = $derived(
        step
            ? issuesOf(step, workflow.edges)
            : workflow.steps.flatMap((s) =>
                  issuesOf(s, workflow.edges).map((issue) => `${s.data.title}: ${issue}`),
              ),
    );

    function set(data: Record<string, unknown>): void {
        if (step) model.run("node.set-data", { nodeId: step.id, data });
    }

    function remove(): void {
        if (step) model.run("node.remove", { nodeId: step.id });
    }
</script>

<aside aria-label="Inspector" class={styles.inspector}>
    <div class={styles.inspectorHeader}>
        <h2 class={styles.inspectorTitle}>
            {step ? `${TYPE_LABELS[step.type]} settings` : "Workflow"}
        </h2>
        {#if step}
            <button type="button" aria-label="Delete step" class={styles.iconButton} onclick={remove}>
                <Trash2Icon />
            </button>
        {/if}
    </div>
    {#if step}
        {#key step.id}
            <div class={styles.fields}>
                <Field.Root>
                    <Field.Label>Name</Field.Label>
                    <Field.Row>
                        <Field.Body>
                            <Input
                                value={step.data.title}
                                oninput={(event) => set({ title: event.currentTarget.value })}
                            />
                        </Field.Body>
                    </Field.Row>
                </Field.Root>
                {#if step.type === "trigger"}
                    <Field.Root>
                        <Field.Label>Starts on</Field.Label>
                        <Select.Root
                            value={step.data.kind}
                            onchange={(event) => set({ kind: event.currentTarget.value })}
                        >
                            {#each Object.entries(TRIGGERS) as [value, label] (value)}
                                <Select.Item {value}>{label}</Select.Item>
                            {/each}
                        </Select.Root>
                    </Field.Root>
                {/if}
                {#if step.type === "trigger" || step.type === "action"}
                    <Field.Root>
                        <Field.Label>
                            {step.type === "trigger" ? "Source" : "Target"}
                        </Field.Label>
                        <Field.Row>
                            <Field.Body>
                                <Input
                                    value={step.data.detail}
                                    oninput={(event) => set({ detail: event.currentTarget.value })}
                                />
                            </Field.Body>
                        </Field.Row>
                    </Field.Root>
                {/if}
                {#if step.type === "condition"}
                    <Field.Root>
                        <Field.Label>Condition</Field.Label>
                        <Field.Row>
                            <Field.Body>
                                <Input
                                    value={step.data.expression}
                                    spellcheck={false}
                                    oninput={(event) =>
                                        set({ expression: event.currentTarget.value })}
                                />
                            </Field.Body>
                        </Field.Row>
                    </Field.Root>
                {/if}
                {#if step.type === "delay"}
                    <Field.Root>
                        <Field.Label>Wait (minutes)</Field.Label>
                        <Field.Row>
                            <Field.Body>
                                <Input
                                    type="number"
                                    min={1}
                                    value={step.data.minutes}
                                    oninput={(event) => {
                                        const minutes = Math.max(
                                            1,
                                            Number(event.currentTarget.value) || 1,
                                        );
                                        set({ minutes });
                                        // the model may keep its value (1 stays 1): show it
                                        event.currentTarget.value = String(minutes);
                                    }}
                                />
                            </Field.Body>
                        </Field.Row>
                    </Field.Root>
                {/if}
            </div>
        {/key}
    {:else}
        <p class={styles.muted}>
            {workflow.steps.length} steps, {workflow.edges.length} connections. Select a step to edit
            it.
        </p>
    {/if}
    <div role="status" data-testid="issues" class={styles.issues}>
        {#if issues.length === 0}
            <p class={styles.ok}>
                <CircleCheckIcon />
                {step ? "This step is ready." : "Ready to publish."}
            </p>
        {:else}
            <ul class={styles.issueList}>
                <!-- two steps may have the same title and issue: derived, never reordered -->
                {#each issues as issue, index (index)}
                    <li class={styles.issue}>
                        <CircleAlertIcon />
                        {issue}
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
</aside>
