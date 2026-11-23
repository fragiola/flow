import type { ExampleMeta } from "../meta-types";

export default {
    title: "Sub-flows",
    description:
        "Groups that hold child nodes: a child moves with its group and stays inside it, dragging a node onto a group puts it in, and edges between children are drawn above the groups.",
    level: "nodes",
    order: 8,
    features: [
        "subflows()",
        "parentId",
        "extent: parent",
        "node.set-parent",
        "zIndexMode",
    ],
    docs: "/docs/guides/sub-flows",
} satisfies ExampleMeta;
