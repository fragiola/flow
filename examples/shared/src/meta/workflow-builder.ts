import type { ExampleMeta } from "../meta-types";

export default {
    title: "Workflow builder",
    description:
        "An automation editor: drag triggers, actions and conditions from the palette, wire them with typed ports the middleware validates, and configure the selected step.",
    level: "apps",
    order: 1,
    features: [
        "typed custom nodes",
        "middleware",
        "minimap()",
        "Flow.Controls",
        "screen-to-flow",
        "useSelection",
    ],
    height: 600,
} satisfies ExampleMeta;
