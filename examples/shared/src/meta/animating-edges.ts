import type { ExampleMeta } from "../meta-types";

export default {
    title: "Animating edges",
    description:
        "A dot travelling along an edge's path, dashes flowing along another, and a pulse that runs once when a value passes; under reduced motion nothing moves.",
    level: "edges",
    order: 4,
    features: [
        "animateMotion",
        "useEdge",
        "Flow.EdgePath",
        "prefers-reduced-motion",
        "animationend",
    ],
    docs: "/docs/guides/custom-edges#animated-edges",
} satisfies ExampleMeta;
