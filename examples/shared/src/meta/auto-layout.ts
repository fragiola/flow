import type { ExampleMeta } from "../meta-types";

export default {
    title: "Auto layout",
    description:
        "A mind map that lays itself out again with dagre after every change: a “+” under each topic adds a child in one batch, a toggle collapses or expands a subtree by hiding its nodes and edges, and the shown nodes glide to their new places.",
    level: "layout",
    order: 3,
    features: [
        "@dagrejs/dagre",
        "batch",
        "node.set-flags (hidden)",
        "edge.set-flags (hidden)",
        "node.set-data",
        "batch (transient)",
        "fit-view (duration)",
    ],
    docs: "/docs/concepts/model-and-commands#transient-steps-and-batches",
} satisfies ExampleMeta;
