import type { ExampleMeta } from "../meta-types";

export default {
    title: "Sub-flows",
    description:
        "Groups that hold child nodes: a child moves with its group and stays inside it, and dragging a node onto a group puts it in.",
    level: "building-blocks",
    order: 1,
    features: ["subflows()", "parentId", "extent: parent", "node.set-parent"],
    docs: "/docs/guides/sub-flows",
} satisfies ExampleMeta;
