import type { ExampleMeta } from "../meta-types";

export default {
    title: "Snap to grid",
    description:
        "Nodes snap to a grid while they are dragged; choose the grid size and see the background follow it.",
    level: "interaction",
    order: 4,
    features: ["drag({ snapGrid })", "Flow.Background gap"],
    docs: "/docs/concepts/viewport",
} satisfies ExampleMeta;
