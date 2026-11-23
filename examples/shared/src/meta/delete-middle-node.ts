import type { ExampleMeta } from "../meta-types";

export default {
    title: "Delete middle node",
    description:
        "Delete a node with the Delete key or its own button, and each node that led into it is joined to each node it led to: no duplicate edge, no self loop, all in one batch with the removal.",
    level: "nodes",
    order: 7,
    features: [
        "incomers-by",
        "outgoers-by",
        "connected-edges-by",
        "batch",
        "beforeDelete",
    ],
    docs: "/docs/guides/keyboard",
} satisfies ExampleMeta;
