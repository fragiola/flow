import type { ExampleMeta } from "../meta-types";

export default {
    title: "Edge reconnect",
    description:
        "Grab either end of an edge and drop it on another handle to reconnect it; drop it nowhere and it snaps back.",
    level: "edges",
    order: 7,
    features: ["reconnection()", "Flow.ReconnectAnchor", "edge.reconnect"],
    docs: "/docs/guides/connection-rules",
} satisfies ExampleMeta;
