import type { ExampleMeta } from "../meta-types";

export default {
    title: "Easy connect",
    description:
        "No small handles to aim at: a node's border starts a connection and the whole node takes it, by a drag or by two taps, with a larger border on a touch screen.",
    level: "connections",
    order: 2,
    features: [
        'connection({ mode: "loose" })',
        "clickToConnect",
        "large handles",
        "pointer: coarse",
        "floating edges",
    ],
    docs: "/docs/guides/connection-rules",
} satisfies ExampleMeta;
