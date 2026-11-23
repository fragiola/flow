import type { ExampleMeta } from "../meta-types";

export default {
    title: "Dagre layout",
    description:
        "A tree laid out by dagre from its nodes' declared sizes, opened arranged; switching the direction lays it out again, moves the handles to the matching sides and animates the nodes to their new places with transient moves, then one final batch.",
    level: "layout",
    order: 1,
    features: [
        "@dagrejs/dagre",
        "width / height",
        "batch (transient)",
        "node.move",
        "fit-view (duration)",
        "handle sides",
    ],
    docs: "/docs/concepts/model-and-commands#transient-steps-and-batches",
} satisfies ExampleMeta;
