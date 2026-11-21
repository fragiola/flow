import type { ExampleMeta } from "../meta-types";

export default {
    title: "Basic flow",
    description:
        "Four nodes joined by edges: pan the canvas, zoom with the wheel or a pinch, drag a node, and draw a new edge from a handle.",
    level: "basics",
    order: 1,
    features: [
        "Flow.Root",
        "Flow.Nodes",
        "Flow.Edges",
        "Flow.Handle",
        "defaultNodes",
        "fitView",
    ],
    docs: "/docs/getting-started/first-flow",
} satisfies ExampleMeta;
