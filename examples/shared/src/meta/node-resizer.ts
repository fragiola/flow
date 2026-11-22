import type { ExampleMeta } from "../meta-types";

export default {
    title: "Node resizer",
    description:
        "Resize nodes from their corners and sides, by drag or by the arrows, with a minimum size, a maximum size and one node that keeps its ratio.",
    level: "building-blocks",
    order: 2,
    features: [
        "resize()",
        "NodeResizer",
        "ResizeHandle",
        "keepAspectRatio",
        "keyboard resize",
    ],
    docs: "/docs/guides/resizing",
} satisfies ExampleMeta;
