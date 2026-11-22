import type { ExampleMeta } from "../meta-types";

export default {
    title: "Announcements",
    description:
        "A live region the app feeds from engine events, so a screen reader hears what moved, connected or was removed, and each target of a keyboard connection.",
    level: "building-blocks",
    order: 7,
    features: [
        "engine.subscribe",
        "aria-live",
        "nodes-move",
        "connect",
        "connect-target",
        "remove",
    ],
    docs: "/docs/getting-started/accessible-names",
} satisfies ExampleMeta;
