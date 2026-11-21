import { Component, computed, input } from "@angular/core";
import { FLOW, injectEdges } from "@fragiola/flow-angular";
import { LucideDynamicIcon } from "@lucide/angular";
import { iconOf, summaryOf, TYPE_LABELS } from "./catalog";
import { issuesOf } from "./rules";
import { styles } from "./styles";
import type { Step, Types } from "./types";

// One step's card: its type's icon and palette, its title and summary, a mark when it has issues,
// and its ports. Every step but a trigger has an input on top; a condition has a "yes" and a "no"
// output, the others one output below. It renders inside its node's element
// (`<div [flowNode]="step" [exampleWorkflowStep]="step">`): its handles belong to that node.

/** A condition's two outputs, and where each sits along its bottom side. */
const BRANCHES = [
    { branch: "yes", left: "30%" },
    { branch: "no", left: "70%" },
] as const;

@Component({
    selector: "[exampleWorkflowStep]",
    imports: [FLOW, LucideDynamicIcon],
    template: `
        <span [class]="styles.stepIcon(step().type)">
            <svg [lucideIcon]="icon()" aria-hidden="true"></svg>
        </span>
        <span [class]="styles.stepText">
            <span [class]="styles.stepType">{{ labels[step().type] }}</span>
            <span [class]="styles.stepTitle">{{ step().data.title }}</span>
            <span [class]="styles.stepSummary">{{ summary() }}</span>
        </span>
        @if (issues().length > 0) {
            <span
                role="img"
                [attr.aria-label]="issues().length + (issues().length > 1 ? ' issues' : ' issue')"
                [attr.title]="issues().join(' ')"
                [class]="styles.issueMark"
            >{{ issues().length }}</span>
        }
        @if (step().type !== "trigger") {
            <div flowHandle type="target" side="top" handleId="in" [class]="styles.port"></div>
        }
        @if (step().type === "condition") {
            @for (output of branches; track output.branch) {
                <div
                    flowHandle
                    type="source"
                    side="bottom"
                    [handleId]="output.branch"
                    [attr.title]="output.branch"
                    [class]="styles.branchPort(output.branch)"
                    [style.left]="output.left"
                ></div>
            }
        } @else {
            <div flowHandle type="source" side="bottom" handleId="out" [class]="styles.port"></div>
        }
    `,
})
export class StepNode {
    readonly step = input.required<Step>({ alias: "exampleWorkflowStep" });
    protected readonly styles = styles;
    protected readonly labels = TYPE_LABELS;
    protected readonly branches = BRANCHES;
    // the edges, read with an injection function: the mark follows every connection made or removed
    private readonly edges = injectEdges<Types>();
    protected readonly icon = computed(() => iconOf(this.step()));
    protected readonly summary = computed(() => summaryOf(this.step()));
    // kept while its issues are the same: an edge made elsewhere leaves this card's mark as it is
    protected readonly issues = computed(
        () => issuesOf(this.step(), this.edges()),
        { equal: sameList },
    );
}

/** Two lists of the same entries, in order. */
function sameList(a: readonly string[], b: readonly string[]): boolean {
    return (
        a.length === b.length && a.every((entry, index) => entry === b[index])
    );
}
