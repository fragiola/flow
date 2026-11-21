import type { ExampleMeta } from "../meta-types";

export default {
    title: "Node toolbar",
    description:
        "A toolbar above the selected node, outside the zoom: duplicate, recolour or delete it.",
    level: "building-blocks",
    order: 3,
    features: ["Flow.NodeToolbar", "node.add", "node.set-data", "node.remove"],
    docs: "/docs/api/primitives/node-toolbar",
} satisfies ExampleMeta;
