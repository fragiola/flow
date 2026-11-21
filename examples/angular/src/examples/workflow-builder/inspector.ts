import { Component, computed, input } from "@angular/core";
import type { FlowModel } from "@fragiola/flow-angular";
import {
    LucideCircleAlert,
    LucideCircleCheck,
    LucideTrash2,
} from "@lucide/angular";
import { Input } from "#/components/atoms/fields";
import { FIELD } from "#/components/ui/field";
import { SELECT } from "#/components/ui/select";
import { TYPE_LABELS } from "./catalog";
import { injectWorkflow } from "./inject-workflow";
import { issuesOf } from "./rules";
import { styles } from "./styles";
import type { TriggerKind, Types } from "./types";

// The side panel: the selected step's settings (each field runs `node.set-data`), or, with nothing
// selected, the workflow's summary and every issue left. It sits beside the root and reads the
// model it is given.

const TRIGGERS: Record<TriggerKind, string> = {
    webhook: "Webhook",
    schedule: "Schedule",
    form: "Form submitted",
};

@Component({
    selector: "example-workflow-inspector",
    imports: [
        FIELD,
        Input,
        SELECT,
        LucideTrash2,
        LucideCircleCheck,
        LucideCircleAlert,
    ],
    host: { class: "contents" },
    template: `
        <aside aria-label="Inspector" [class]="styles.inspector">
            <div [class]="styles.inspectorHeader">
                <h2 [class]="styles.inspectorTitle">{{ title() }}</h2>
                @if (step(); as current) {
                    <button
                        type="button"
                        aria-label="Delete step"
                        [class]="styles.iconButton"
                        (click)="remove(current.id)"
                    >
                        <svg lucideTrash2 aria-hidden="true"></svg>
                    </button>
                }
            </div>
            @if (step(); as current) {
                <div [class]="styles.fields">
                    <div kitFieldRoot>
                        <label kitFieldLabel>Name</label>
                        <div kitFieldRow>
                            <div kitFieldBody>
                                <input
                                    kitInput
                                    [value]="current.data.title"
                                    (input)="set(current.id, { title: valueOf($event) })"
                                />
                            </div>
                        </div>
                    </div>
                    @if (current.type === "trigger") {
                        <div kitFieldRoot>
                            <label kitFieldLabel>Starts on</label>
                            <kit-select
                                [value]="current.data.kind"
                                (valueChange)="set(current.id, { kind: $event })"
                            >
                                @for (trigger of triggers; track trigger[0]) {
                                    <option kitSelectItem [value]="trigger[0]">{{ trigger[1] }}</option>
                                }
                            </kit-select>
                        </div>
                    }
                    @if (current.type === "trigger" || current.type === "action") {
                        <div kitFieldRoot>
                            <label kitFieldLabel>{{ current.type === "trigger" ? "Source" : "Target" }}</label>
                            <div kitFieldRow>
                                <div kitFieldBody>
                                    <input
                                        kitInput
                                        [value]="current.data.detail"
                                        (input)="set(current.id, { detail: valueOf($event) })"
                                    />
                                </div>
                            </div>
                        </div>
                    }
                    @if (current.type === "condition") {
                        <div kitFieldRoot>
                            <label kitFieldLabel>Condition</label>
                            <div kitFieldRow>
                                <div kitFieldBody>
                                    <input
                                        kitInput
                                        spellcheck="false"
                                        [value]="current.data.expression"
                                        (input)="set(current.id, { expression: valueOf($event) })"
                                    />
                                </div>
                            </div>
                        </div>
                    }
                    @if (current.type === "delay") {
                        <div kitFieldRoot>
                            <label kitFieldLabel>Wait (minutes)</label>
                            <div kitFieldRow>
                                <div kitFieldBody>
                                    <input
                                        kitInput
                                        type="number"
                                        min="1"
                                        [value]="current.data.minutes"
                                        (input)="setMinutes(current.id, $event)"
                                    />
                                </div>
                            </div>
                        </div>
                    }
                </div>
            } @else {
                <p [class]="styles.muted">
                    {{ workflow.steps().length }} steps, {{ workflow.edges().length }} connections.
                    Select a step to edit it.
                </p>
            }
            <div role="status" data-testid="issues" [class]="styles.issues">
                @if (issues().length === 0) {
                    <p [class]="styles.ok">
                        <svg lucideCircleCheck aria-hidden="true"></svg>
                        {{ step() ? "This step is ready." : "Ready to publish." }}
                    </p>
                } @else {
                    <ul [class]="styles.issueList">
                        <!-- two steps may have the same title and issue: derived, never reordered -->
                        @for (issue of issues(); track $index) {
                            <li [class]="styles.issue">
                                <svg lucideCircleAlert aria-hidden="true"></svg>
                                {{ issue }}
                            </li>
                        }
                    </ul>
                }
            </div>
        </aside>
    `,
})
export class Inspector {
    readonly model = input.required<FlowModel<Types>>();
    protected readonly styles = styles;
    protected readonly triggers = Object.entries(TRIGGERS);
    protected readonly workflow = injectWorkflow(this.model);
    protected readonly step = computed(() => {
        const selected = this.workflow
            .steps()
            .filter((s) => s.selected === true);
        return selected.length === 1 ? selected[0] : undefined;
    });
    protected readonly title = computed(() => {
        const step = this.step();
        return step ? `${TYPE_LABELS[step.type]} settings` : "Workflow";
    });
    protected readonly issues = computed(() => {
        const step = this.step();
        const edges = this.workflow.edges();
        return step
            ? issuesOf(step, edges)
            : this.workflow
                  .steps()
                  .flatMap((s) =>
                      issuesOf(s, edges).map(
                          (issue) => `${s.data.title}: ${issue}`,
                      ),
                  );
    });

    protected valueOf(event: Event): string {
        return (event.target as HTMLInputElement).value;
    }

    protected set(nodeId: string, data: Record<string, unknown>): void {
        this.model().run("node.set-data", { nodeId, data });
    }

    protected setMinutes(nodeId: string, event: Event): void {
        const field = event.target as HTMLInputElement;
        const minutes = Math.max(1, Number(field.value) || 1);
        this.set(nodeId, { minutes });
        // the model may keep its value (1 stays 1): show it
        field.value = String(minutes);
    }

    protected remove(nodeId: string): void {
        this.model().run("node.remove", { nodeId });
    }
}
