import type { ExampleMeta } from "../meta-types";

export default {
    title: "Proximity connect",
    description:
        "Drag a node close to another and a dashed temporary edge shows the connection it would make; drop it there and the edge is added. The temporary edge is the example's own state, never the document's.",
    level: "connections",
    order: 3,
    features: [
        "drag-start",
        "nodes-move",
        "node-rect-by",
        "useFlowStore",
        "temporary edge",
    ],
    docs: "/docs/guides/connection-rules",
} satisfies ExampleMeta;
