import type { ExampleMeta } from "../meta-types";

export default {
    title: "Node toolbar",
    description:
        "A toolbar above the selected note, outside the zoom, and one below the selection for several notes: duplicate, recolour or delete.",
    level: "nodes",
    order: 4,
    features: [
        "Flow.NodeToolbar",
        "nodeIds",
        "node.add",
        "node.set-data",
        "node.remove",
        "selection.remove",
    ],
    docs: "/docs/api/primitives/node-toolbar",
} satisfies ExampleMeta;
