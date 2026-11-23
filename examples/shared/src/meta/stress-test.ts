import type { ExampleMeta } from "../meta-types";

export default {
    title: "Stress test",
    description:
        "A generated flow of 1,000 to 20,000 nodes and as many edges: only the ones in view are in the DOM, Shuffle moves every node in one batch, and a readout shows the DOM's size and the frame time.",
    level: "basics",
    order: 5,
    features: [
        "onlyRenderVisible",
        "batch",
        "node.move",
        "width / height",
        "handles",
    ],
    docs: "/docs/guides/large-flows",
} satisfies ExampleMeta;
