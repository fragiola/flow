import type { ExampleMeta } from "../meta-types";

export default {
    title: "Add nodes",
    description:
        "Drag a node type from a palette onto the canvas, or click it to add one at the centre: screen-to-flow places it under the pointer.",
    level: "building-blocks",
    order: 4,
    features: [
        "useFlowRef",
        "screen-to-flow",
        "node.add",
        "HTML drag and drop",
    ],
    docs: "/docs/guides/custom-nodes",
} satisfies ExampleMeta;
