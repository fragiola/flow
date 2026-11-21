import type { FlowNodeInput, XY } from "@fragiola/flow-svelte";
import {
    ClockIcon,
    DatabaseIcon,
    FileTextIcon,
    GitBranchIcon,
    GlobeIcon,
    MailIcon,
    MessageSquareIcon,
    TimerIcon,
    WebhookIcon,
} from "@lucide/svelte";
import type { Component } from "svelte";
import type { Step, StepType, Types } from "./types";

// What the palette offers: each entry makes a new step of one type, with its starting data.

export interface CatalogEntry {
    id: string;
    group: "Triggers" | "Actions" | "Logic";
    label: string;
    icon: Component;
    /** a new step of this entry, with its id and its top-left corner */
    create: (id: string, position: XY) => FlowNodeInput<Types>;
}

export const CATALOG: CatalogEntry[] = [
    {
        id: "webhook",
        group: "Triggers",
        label: "Webhook",
        icon: WebhookIcon,
        create: (id, position) => ({
            id,
            position,
            type: "trigger",
            data: {
                title: "Webhook",
                kind: "webhook",
                detail: "POST /hooks/orders",
            },
        }),
    },
    {
        id: "schedule",
        group: "Triggers",
        label: "Schedule",
        icon: ClockIcon,
        create: (id, position) => ({
            id,
            position,
            type: "trigger",
            data: {
                title: "Every morning",
                kind: "schedule",
                detail: "09:00, weekdays",
            },
        }),
    },
    {
        id: "form",
        group: "Triggers",
        label: "Form submitted",
        icon: FileTextIcon,
        create: (id, position) => ({
            id,
            position,
            type: "trigger",
            data: {
                title: "Form submitted",
                kind: "form",
                detail: "Contact form",
            },
        }),
    },
    {
        id: "email",
        group: "Actions",
        label: "Send email",
        icon: MailIcon,
        create: (id, position) => ({
            id,
            position,
            type: "action",
            data: {
                title: "Send email",
                kind: "email",
                detail: "customer@example.com",
            },
        }),
    },
    {
        id: "slack",
        group: "Actions",
        label: "Post to Slack",
        icon: MessageSquareIcon,
        create: (id, position) => ({
            id,
            position,
            type: "action",
            data: { title: "Post to Slack", kind: "slack", detail: "#orders" },
        }),
    },
    {
        id: "http",
        group: "Actions",
        label: "HTTP request",
        icon: GlobeIcon,
        create: (id, position) => ({
            id,
            position,
            type: "action",
            data: {
                title: "HTTP request",
                kind: "http",
                detail: "GET https://api.example.com",
            },
        }),
    },
    {
        id: "database",
        group: "Actions",
        label: "Update record",
        icon: DatabaseIcon,
        create: (id, position) => ({
            id,
            position,
            type: "action",
            data: {
                title: "Update record",
                kind: "database",
                detail: "orders.status",
            },
        }),
    },
    {
        id: "condition",
        group: "Logic",
        label: "If / else",
        icon: GitBranchIcon,
        create: (id, position) => ({
            id,
            position,
            type: "condition",
            data: { title: "If / else", expression: "order.total > 100" },
        }),
    },
    {
        id: "delay",
        group: "Logic",
        label: "Wait",
        icon: TimerIcon,
        create: (id, position) => ({
            id,
            position,
            type: "delay",
            data: { title: "Wait", minutes: 30 },
        }),
    },
];

/** The icon of a step. */
export function iconOf(step: Step): Component {
    if (step.type === "trigger" || step.type === "action") {
        return (
            CATALOG.find((entry) => entry.id === step.data.kind)?.icon ??
            WebhookIcon
        );
    }
    return step.type === "condition" ? GitBranchIcon : TimerIcon;
}

/** What a step's type is called on its card. */
export const TYPE_LABELS: Record<StepType, string> = {
    trigger: "Trigger",
    action: "Action",
    condition: "Condition",
    delay: "Delay",
};

/** A step's one-line summary. */
export function summaryOf(step: Step): string {
    switch (step.type) {
        case "trigger":
        case "action":
            return step.data.detail;
        case "condition":
            return step.data.expression;
        case "delay":
            return `${step.data.minutes} min`;
    }
}
