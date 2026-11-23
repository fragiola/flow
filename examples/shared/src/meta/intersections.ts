import type { ExampleMeta } from "../meta-types";

export default {
    title: "Intersections",
    description:
        "Drag a node and the nodes it overlaps and the edges it crosses are marked while it moves; with “Resolve collisions” on, the drop pushes the overlapped nodes away, every move in one batch.",
    level: "nodes",
    order: 6,
    features: [
        "intersecting-nodes",
        "edge-path-by",
        "dragging-node-ids",
        "useFlowStore",
        "batch",
    ],
    docs: "/docs/api/engine",
} satisfies ExampleMeta;
