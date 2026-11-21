import type { ExampleMeta } from "../meta-types";

export default {
    title: "Save and restore",
    description:
        "Save the flow and its viewport to local storage, change it, and restore it: the document is plain JSON.",
    level: "building-blocks",
    order: 5,
    features: ["flow-json", "commands-to", "set-viewport", "persistence"],
    docs: "/docs/guides/persistence",
} satisfies ExampleMeta;
