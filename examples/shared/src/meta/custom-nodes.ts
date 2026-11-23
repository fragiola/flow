import type { ExampleMeta } from "../meta-types";

export default {
    title: "Custom nodes",
    description:
        "Each node type renders its own content from its typed data: a colour picker, a number input and a preview, with handles where each needs them.",
    level: "nodes",
    order: 1,
    features: [
        "Types registry",
        "node.set-data",
        "several handles per side",
        "data-flow-no-gesture",
    ],
    docs: "/docs/guides/custom-nodes",
} satisfies ExampleMeta;
