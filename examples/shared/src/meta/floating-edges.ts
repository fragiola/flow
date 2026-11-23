import type { ExampleMeta } from "../meta-types";

export default {
    title: "Floating edges",
    description:
        "Edges with no handles: each meets the nearest point of its nodes' borders (a box or an ellipse), straight or bezier, or the middle of the nearest side, and follows the nodes while they move.",
    level: "edges",
    order: 5,
    features: [
        "useInternalNode",
        "straightPath / bezierPath",
        "Flow.EdgePath",
        "border intersection",
    ],
    docs: "/docs/guides/custom-edges#an-edge-type-of-your-own",
} satisfies ExampleMeta;
