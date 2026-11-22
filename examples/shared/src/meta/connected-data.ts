import type { ExampleMeta } from "../meta-types";

export default {
    title: "Data from connections",
    description:
        "A node that sums the values of the nodes connected into it, reading its connections and their data with the selecting hooks: it updates when a value or a connection changes, and only then.",
    level: "building-blocks",
    order: 9,
    features: [
        "useNodeConnections",
        "useNodesData",
        "useNodeId",
        "connection()",
    ],
    docs: "/docs/api/primitives/hooks",
} satisfies ExampleMeta;
