import { Flow, useEdges } from "@fragiola/flow-react";
import { iconOf, summaryOf, TYPE_LABELS } from "./catalog";
import { issuesOf } from "./rules";
import { styles } from "./styles";
import type { Step, Types } from "./types";

// One step's card: its type's icon and palette, its title and summary, a mark when it has issues,
// and its ports. Every step but a trigger has an input on top; a condition has a "yes" and a "no"
// output, the others one output below.

function Issues({ step }: { step: Step }) {
    // the edges, read with a hook: the mark follows every connection made or removed
    const issues = issuesOf(step, useEdges<Types>());
    if (issues.length === 0) return null;
    return (
        <span
            role="img"
            aria-label={`${issues.length} issue${issues.length > 1 ? "s" : ""}`}
            title={issues.join(" ")}
            className={styles.issueMark}
        >
            {issues.length}
        </span>
    );
}

/** A condition's two outputs, and where each sits along its bottom side. */
const BRANCHES = [
    { branch: "yes", left: "30%" },
    { branch: "no", left: "70%" },
] as const;

export function renderStep(step: Step) {
    const Icon = iconOf(step);
    return (
        <Flow.Node<Types>
            node={step}
            role="group"
            aria-roledescription="step"
            aria-label={`${TYPE_LABELS[step.type]}: ${step.data.title}`}
            className={styles.step}
        >
            <span className={styles.stepIcon(step.type)}>
                <Icon />
            </span>
            <span className={styles.stepText}>
                <span className={styles.stepType}>
                    {TYPE_LABELS[step.type]}
                </span>
                <span className={styles.stepTitle}>{step.data.title}</span>
                <span className={styles.stepSummary}>{summaryOf(step)}</span>
            </span>
            <Issues step={step} />
            {step.type !== "trigger" && (
                <Flow.Handle
                    type="target"
                    side="top"
                    handleId="in"
                    aria-label={`${step.data.title} input`}
                    className={styles.port}
                />
            )}
            {step.type === "condition" ? (
                BRANCHES.map(({ branch, left }) => (
                    <Flow.Handle
                        key={branch}
                        type="source"
                        side="bottom"
                        handleId={branch}
                        title={branch}
                        aria-label={`${step.data.title} output: ${branch}`}
                        className={styles.branchPort(branch)}
                        style={{ left }}
                    />
                ))
            ) : (
                <Flow.Handle
                    type="source"
                    side="bottom"
                    handleId="out"
                    aria-label={`${step.data.title} output`}
                    className={styles.port}
                />
            )}
        </Flow.Node>
    );
}
