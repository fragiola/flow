import type { ExampleMeta } from "../meta-types";

export default {
    title: "Connection validation",
    description:
        "A middleware decides which connections are allowed: typed ports only join their own type, no cycles, one input per port. A refused handle shows it while you drag.",
    level: "connections",
    order: 1,
    features: ["model.use", "veto", "edge.add", "data-valid", "data-invalid"],
    docs: "/docs/guides/connection-rules",
} satisfies ExampleMeta;
