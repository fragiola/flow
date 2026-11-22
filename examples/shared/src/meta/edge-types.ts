import type { ExampleMeta } from "../meta-types";

export default {
    title: "Edge types",
    description:
        "The five built-in paths side by side (bezier, simple bezier, smooth step, step, straight), two shaped by their own path options, one animated, and an app type drawn from the edge's ends.",
    level: "basics",
    order: 3,
    features: [
        "edge type",
        "bezierPath",
        "simplebezier",
        "smoothStepPath",
        "Flow.EdgePath d",
        "useEdge",
        "pathOptions",
        "animated",
    ],
    docs: "/docs/guides/custom-edges",
} satisfies ExampleMeta;
