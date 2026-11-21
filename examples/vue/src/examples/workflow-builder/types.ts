import type { FlowNode, FlowTypes } from "@fragiola/flow-vue";

// The workflow's types: four kinds of step, each with its own data. The registry types every node
// the flow renders, every command's payload and every middleware's context.

export type TriggerKind = "webhook" | "schedule" | "form";
export type ActionKind = "email" | "slack" | "http" | "database";

export interface Types extends FlowTypes {
    readonly nodes: {
        trigger: { title: string; kind: TriggerKind; detail: string };
        action: { title: string; kind: ActionKind; detail: string };
        condition: { title: string; expression: string };
        delay: { title: string; minutes: number };
    };
}

export type Step = FlowNode<Types>;
export type StepType = Step["type"];
