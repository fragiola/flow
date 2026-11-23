import type { ExampleMeta } from "../meta-types";

export default {
    title: "Helper lines",
    description:
        "While a node is dragged, guide lines show where its edges or centre line up with another node's, and it snaps onto them within a few pixels; the snap is a middleware over the drag's transient moves.",
    level: "interaction",
    order: 3,
    features: [
        "model.use",
        "node.move (transient)",
        "dragging-node-ids",
        "useFlowStore",
        "guides in flow coordinates",
    ],
    docs: "/docs/concepts/model-and-commands#middleware-veto-or-rewrite",
} satisfies ExampleMeta;
