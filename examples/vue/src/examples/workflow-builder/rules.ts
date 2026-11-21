import {
    type FlowDocument,
    type FlowEdge,
    type Middleware,
    veto,
} from "@fragiola/flow-vue";
import type { Step, Types } from "./types";

// The workflow's rules. Connection rules are a middleware (`model.use`): it sees every `edge.add`
// and `edge.reconnect`, whether a user draws it or code runs it, and its veto marks the handle
// invalid while a connection is drawn. The issues are what a finished workflow still lacks: they
// are read from the document, never stored.

/** Whether `from` already reaches `to` through the edges. */
function reaches(
    edges: readonly FlowEdge<Types>[],
    from: string,
    to: string,
): boolean {
    const seen = new Set<string>();
    const queue = [from];
    while (queue.length > 0) {
        const id = queue.shift() as string;
        if (id === to) return true;
        if (seen.has(id)) continue;
        seen.add(id);
        for (const edge of edges)
            if (edge.source === id) queue.push(edge.target);
    }
    return false;
}

/** Why an edge from `source`'s `sourceHandle` to `target` is refused, or nothing. */
export function refusal(
    document: FlowDocument<Types>,
    edge: { source: string; target: string; sourceHandle?: string | undefined },
    ignoreEdgeId?: string,
): string | undefined {
    const edges = document.edges.filter((e) => e.id !== ignoreEdgeId);
    const target = document.nodes.find((node) => node.id === edge.target);
    if (edge.source === edge.target) return "a step cannot follow itself";
    if (target?.type === "trigger")
        return "a trigger starts a workflow: nothing leads into it";
    if (reaches(edges, edge.target, edge.source))
        return "that would loop back to an earlier step";
    const taken = edges.some(
        (e) =>
            e.source === edge.source &&
            (e.sourceHandle ?? "out") === (edge.sourceHandle ?? "out"),
    );
    if (taken) return "each output leads to one next step";
    return undefined;
}

/** The connection rules, as a middleware. */
export const workflowRules: Middleware<Types> = (ctx, next) => {
    if (ctx.command === "edge.add") {
        const why = refusal(ctx.state, ctx.payload);
        return why ? veto(why) : next();
    }
    if (ctx.command === "edge.reconnect") {
        const why = refusal(ctx.state, ctx.payload, ctx.payload.edgeId);
        return why ? veto(why) : next();
    }
    return next();
};

/** What a step still lacks, in words. */
export function issuesOf(
    step: Step,
    edges: readonly FlowEdge<Types>[],
): string[] {
    const issues: string[] = [];
    const incoming = edges.some((edge) => edge.target === step.id);
    const outgoing = edges.filter((edge) => edge.source === step.id);
    if (step.type !== "trigger" && !incoming)
        issues.push("Nothing leads to this step.");
    if (step.type === "condition") {
        for (const branch of ["yes", "no"] as const) {
            if (!outgoing.some((edge) => edge.sourceHandle === branch)) {
                issues.push(`The “${branch}” branch leads nowhere.`);
            }
        }
    }
    if (step.type === "action" && step.data.detail.trim() === "") {
        issues.push("The action is not configured.");
    }
    return issues;
}
