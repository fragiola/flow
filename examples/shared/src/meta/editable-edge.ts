import type { ExampleMeta } from "../meta-types";

export default {
    title: "Editable edge",
    description:
        "An edge with control points in its data: drag one to bend the edge, double-click the edge to add one, Delete removes it; Route stores an orthogonal way around the nodes as its points.",
    level: "edges",
    order: 6,
    features: [
        "edge.set-data",
        "onEdgeDoubleClick",
        "screen-to-flow",
        "node-rect-by",
        "orthogonal routing",
    ],
    docs: "/docs/guides/custom-edges#an-edge-type-of-your-own",
} satisfies ExampleMeta;
