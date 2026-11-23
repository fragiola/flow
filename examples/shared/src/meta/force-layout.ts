import type { ExampleMeta } from "../meta-types";

export default {
    title: "Force layout",
    description:
        "A network laid out live by a d3-force simulation sized from the nodes' declared boxes: every tick moves the nodes in one transient batch, the settled places land in one final batch; dragging a node pins it and reheats the simulation so the others make room, and Restart releases every pin.",
    level: "layout",
    order: 4,
    features: [
        "d3-force",
        "width / height",
        "batch (transient)",
        "node.move",
        "dragging-node-ids",
        "drag-start / nodes-move",
    ],
    docs: "/docs/concepts/model-and-commands#transient-steps-and-batches",
} satisfies ExampleMeta;
