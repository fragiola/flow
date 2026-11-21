<script module lang="ts">
    import { typedFlow, useEdges } from "@fragiola/flow-svelte";
    import { iconOf, summaryOf, TYPE_LABELS } from "./catalog";
    import { issuesOf } from "./rules";
    import { styles } from "./styles";
    import type { Step, Types } from "./types";

    // One step's card: its type's icon and palette, its title and summary, a mark when it has
    // issues, and its ports. Every step but a trigger has an input on top; a condition has a "yes"
    // and a "no" output, the others one output below.

    /** A condition's two outputs, and where each sits along its bottom side. */
    const BRANCHES = [
        { branch: "yes", left: "30%" },
        { branch: "no", left: "70%" },
    ] as const;

    const Flow = typedFlow<Types>();
</script>

<script lang="ts">
    let { step }: { step: Step } = $props();

    // the edges, read with a rune: the mark follows every connection made or removed
    const edges = useEdges<Types>();
    const issues = $derived(issuesOf(step, edges.current));
    const Icon = $derived(iconOf(step));
</script>

<Flow.Node
    node={step}
    role="group"
    aria-roledescription="step"
    aria-label={`${TYPE_LABELS[step.type]}: ${step.data.title}`}
    class={styles.step}
>
    <span class={styles.stepIcon(step.type)}>
        <Icon />
    </span>
    <span class={styles.stepText}>
        <span class={styles.stepType}>{TYPE_LABELS[step.type]}</span>
        <span class={styles.stepTitle}>{step.data.title}</span>
        <span class={styles.stepSummary}>{summaryOf(step)}</span>
    </span>
    {#if issues.length > 0}
        <span
            role="img"
            aria-label={`${issues.length} issue${issues.length > 1 ? "s" : ""}`}
            title={issues.join(" ")}
            class={styles.issueMark}
        >
            {issues.length}
        </span>
    {/if}
    {#if step.type !== "trigger"}
        <Flow.Handle type="target" side="top" handleId="in" class={styles.port} />
    {/if}
    {#if step.type === "condition"}
        {#each BRANCHES as { branch, left } (branch)}
            <Flow.Handle
                type="source"
                side="bottom"
                handleId={branch}
                title={branch}
                class={styles.branchPort(branch)}
                style={{ left }}
            />
        {/each}
    {:else}
        <Flow.Handle type="source" side="bottom" handleId="out" class={styles.port} />
    {/if}
</Flow.Node>
