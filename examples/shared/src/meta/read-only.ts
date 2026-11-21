import type { ExampleMeta } from "../meta-types";

export default {
    title: "Read-only diagram",
    description:
        "A flow with no features: nodes and edges drawn, the viewport still pans and zooms, nothing can be moved, selected or connected.",
    level: "basics",
    order: 6,
    features: ["no features", "panOnDrag", "zoomOnScroll"],
    docs: "/docs/concepts/features",
} satisfies ExampleMeta;
