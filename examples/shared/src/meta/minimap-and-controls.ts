import type { ExampleMeta } from "../meta-types";

export default {
    title: "Minimap and controls",
    description:
        "A minimap that pans and zooms the flow, and the zoom in, zoom out, fit view and lock buttons, each disabled at its limit.",
    level: "basics",
    order: 4,
    features: [
        "minimap()",
        "MiniMap",
        "Flow.Controls",
        "Flow.ZoomIn",
        "Flow.FitView",
        "Flow.ToggleInteractive",
    ],
    docs: "/docs/guides/minimap-and-controls",
} satisfies ExampleMeta;
