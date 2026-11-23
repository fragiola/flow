import type { ExampleMeta } from "../meta-types";

export default {
    title: "Contextual zoom",
    description:
        "The nodes show more as you zoom in: their name at a glance, then their kind and health, then their owner and figures; the edges' labels show from a zoom of 100%.",
    level: "nodes",
    order: 5,
    features: [
        "useViewport",
        "useFlowStore",
        "Flow.EdgeLabel",
        "Flow.Controls",
    ],
    docs: "/docs/concepts/viewport",
} satisfies ExampleMeta;
