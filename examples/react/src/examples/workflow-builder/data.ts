import type { FlowJson } from "@fragiola/flow-react";
import type { Types } from "./types";

// The workflow the editor opens with: a new order is checked, a big one alerts the team, every
// one gets a confirmation and, a day later, a follow-up.

export const initialWorkflow: FlowJson<Types> = {
    version: 1,
    nodes: [
        {
            id: "order",
            type: "trigger",
            position: { x: 0, y: 0 },
            data: {
                title: "New order",
                kind: "webhook",
                detail: "POST /hooks/orders",
            },
        },
        {
            id: "big",
            type: "condition",
            position: { x: 0, y: 120 },
            data: { title: "Big order?", expression: "order.total > 500" },
        },
        {
            id: "alert",
            type: "action",
            position: { x: -130, y: 250 },
            data: {
                title: "Alert the team",
                kind: "slack",
                detail: "#big-orders",
            },
        },
        {
            id: "confirm",
            type: "action",
            position: { x: 130, y: 250 },
            data: {
                title: "Confirm the order",
                kind: "email",
                detail: "{{order.email}}",
            },
        },
        {
            id: "wait",
            type: "delay",
            position: { x: 130, y: 370 },
            data: { title: "Wait a day", minutes: 1440 },
        },
        {
            id: "follow-up",
            type: "action",
            position: { x: 130, y: 490 },
            data: {
                title: "Ask for a review",
                kind: "email",
                detail: "{{order.email}}",
            },
        },
        {
            id: "record",
            type: "action",
            position: { x: -130, y: 370 },
            data: {
                title: "Flag the order",
                kind: "database",
                detail: "orders.priority = high",
            },
        },
    ],
    edges: [
        {
            id: "order-big",
            source: "order",
            target: "big",
            sourceHandle: "out",
            targetHandle: "in",
            type: "smoothstep",
        },
        {
            id: "big-alert",
            source: "big",
            target: "alert",
            sourceHandle: "yes",
            targetHandle: "in",
            type: "branch",
            data: { branch: "yes" },
        },
        {
            id: "big-confirm",
            source: "big",
            target: "confirm",
            sourceHandle: "no",
            targetHandle: "in",
            type: "branch",
            data: { branch: "no" },
        },
        {
            id: "alert-record",
            source: "alert",
            target: "record",
            sourceHandle: "out",
            targetHandle: "in",
            type: "smoothstep",
        },
        {
            id: "confirm-wait",
            source: "confirm",
            target: "wait",
            sourceHandle: "out",
            targetHandle: "in",
            type: "smoothstep",
        },
        {
            id: "wait-follow-up",
            source: "wait",
            target: "follow-up",
            sourceHandle: "out",
            targetHandle: "in",
            type: "smoothstep",
        },
    ],
};
