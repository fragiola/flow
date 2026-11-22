import type { ExampleMeta } from "../meta-types";

export default {
    title: "Context menu",
    description:
        "Right-click a node, the selection or the canvas for a menu of your own: the root's context-menu callbacks tell where, and a double click marks a task done.",
    level: "building-blocks",
    order: 8,
    features: [
        "onNodeContextMenu",
        "onPaneContextMenu",
        "onSelectionContextMenu",
        "onNodeDoubleClick",
        "onPaneClick",
    ],
    docs: "/docs/guides/selection",
} satisfies ExampleMeta;
