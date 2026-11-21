import type { ExampleMeta } from "../meta-types";

export default {
    title: "Node resizer",
    description:
        "Resize nodes from their corners and sides, with a minimum size, a maximum size and one node that keeps its aspect ratio.",
    level: "building-blocks",
    order: 2,
    features: ["resize()", "NodeResizer", "ResizeHandle", "keepAspectRatio"],
    docs: "/docs/guides/resizing",
} satisfies ExampleMeta;
