import type { ExampleMeta } from "../meta-types";

export default {
    title: "Node resizer",
    description:
        "Resize nodes from their corners and sides, by drag or by the arrows, with a minimum size, a maximum size, one node that keeps its ratio and one that resizes across only.",
    level: "nodes",
    order: 3,
    features: [
        "resize()",
        "NodeResizer",
        "ResizeHandle",
        "keepAspectRatio",
        "direction",
        "keyboard resize",
    ],
    docs: "/docs/guides/resizing",
} satisfies ExampleMeta;
