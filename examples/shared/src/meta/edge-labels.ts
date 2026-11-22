import type { ExampleMeta } from "../meta-types";

export default {
    title: "Edge labels",
    description:
        "HTML labels at each edge's midpoint (a text, a badge, a remove button) and a toolbar on the selected edge that keeps its size at any zoom.",
    level: "basics",
    order: 4,
    features: [
        "Flow.EdgeLabel",
        "Flow.EdgeToolbar",
        "edge.remove",
        "edge.set-data",
        "edge data",
    ],
    docs: "/docs/guides/custom-edges",
} satisfies ExampleMeta;
