import type { FlowModel } from "@fragiola/flow-react";
import { CircleAlertIcon, CircleCheckIcon, Trash2Icon } from "lucide-react";
import { Input } from "#/components/atoms/fields";
import { Field } from "#/components/ui/field";
import { Select } from "#/components/ui/select";
import { TYPE_LABELS } from "./catalog";
import { issuesOf } from "./rules";
import { styles } from "./styles";
import type { Step, TriggerKind, Types } from "./types";
import { useWorkflow } from "./use-workflow";

// The side panel: the selected step's settings (each field runs `node.set-data`), or, with nothing
// selected, the workflow's summary and every issue left. It sits beside the root and reads the
// model it is given.

const TRIGGERS: Record<TriggerKind, string> = {
    webhook: "Webhook",
    schedule: "Schedule",
    form: "Form submitted",
};

function Settings({ model, step }: { model: FlowModel<Types>; step: Step }) {
    const set = (data: Record<string, unknown>) =>
        model.run("node.set-data", { nodeId: step.id, data });
    return (
        <div className={styles.fields}>
            <Field.Root>
                <Field.Label>Name</Field.Label>
                <Field.Row>
                    <Field.Body>
                        <Input
                            value={step.data.title}
                            onChange={(event) =>
                                set({ title: event.target.value })
                            }
                        />
                    </Field.Body>
                </Field.Row>
            </Field.Root>
            {step.type === "trigger" && (
                <Field.Root>
                    <Field.Label>Starts on</Field.Label>
                    <Select.Root
                        items={TRIGGERS}
                        value={step.data.kind}
                        onValueChange={(kind) => set({ kind })}
                    >
                        <Select.Trigger>
                            <Select.Value />
                        </Select.Trigger>
                        <Select.Content>
                            {Object.entries(TRIGGERS).map(([value, label]) => (
                                <Select.Item key={value} value={value}>
                                    {label}
                                </Select.Item>
                            ))}
                        </Select.Content>
                    </Select.Root>
                </Field.Root>
            )}
            {(step.type === "trigger" || step.type === "action") && (
                <Field.Root>
                    <Field.Label>
                        {step.type === "trigger" ? "Source" : "Target"}
                    </Field.Label>
                    <Field.Row>
                        <Field.Body>
                            <Input
                                value={step.data.detail}
                                onChange={(event) =>
                                    set({ detail: event.target.value })
                                }
                            />
                        </Field.Body>
                    </Field.Row>
                </Field.Root>
            )}
            {step.type === "condition" && (
                <Field.Root>
                    <Field.Label>Condition</Field.Label>
                    <Field.Row>
                        <Field.Body>
                            <Input
                                value={step.data.expression}
                                spellCheck={false}
                                onChange={(event) =>
                                    set({ expression: event.target.value })
                                }
                            />
                        </Field.Body>
                    </Field.Row>
                </Field.Root>
            )}
            {step.type === "delay" && (
                <Field.Root>
                    <Field.Label>Wait (minutes)</Field.Label>
                    <Field.Row>
                        <Field.Body>
                            <Input
                                type="number"
                                min={1}
                                value={step.data.minutes}
                                onChange={(event) =>
                                    set({
                                        minutes: Math.max(
                                            1,
                                            Number(event.target.value) || 1,
                                        ),
                                    })
                                }
                            />
                        </Field.Body>
                    </Field.Row>
                </Field.Root>
            )}
        </div>
    );
}

export function Inspector({ model }: { model: FlowModel<Types> }) {
    const { steps, edges } = useWorkflow(model);
    const selected = steps.filter((s) => s.selected === true);
    const step = selected.length === 1 ? selected[0] : undefined;
    const issues = step
        ? issuesOf(step, edges)
        : steps.flatMap((s) =>
              issuesOf(s, edges).map((issue) => `${s.data.title}: ${issue}`),
          );
    return (
        <aside aria-label="Inspector" className={styles.inspector}>
            <div className={styles.inspectorHeader}>
                <h2 className={styles.inspectorTitle}>
                    {step ? `${TYPE_LABELS[step.type]} settings` : "Workflow"}
                </h2>
                {step && (
                    <button
                        type="button"
                        aria-label="Delete step"
                        onClick={() =>
                            model.run("node.remove", { nodeId: step.id })
                        }
                        className={styles.iconButton}
                    >
                        <Trash2Icon />
                    </button>
                )}
            </div>
            {step ? (
                <Settings key={step.id} model={model} step={step} />
            ) : (
                <p className={styles.muted}>
                    {steps.length} steps, {edges.length} connections. Select a
                    step to edit it.
                </p>
            )}
            <div role="status" data-testid="issues" className={styles.issues}>
                {issues.length === 0 ? (
                    <p className={styles.ok}>
                        <CircleCheckIcon />
                        {step ? "This step is ready." : "Ready to publish."}
                    </p>
                ) : (
                    <ul className={styles.issueList}>
                        {issues.map((issue, index) => (
                            // two steps may have the same title and issue
                            // biome-ignore lint/suspicious/noArrayIndexKey: derived, never reordered
                            <li key={index} className={styles.issue}>
                                <CircleAlertIcon />
                                {issue}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </aside>
    );
}
