import type { ExampleMeta } from "../meta-types";

export default {
    title: "Undo and redo",
    description:
        "An undo manager built on the model's events: every drag, connection and deletion is one step, with Ctrl+Z and Ctrl+Shift+Z.",
    level: "building-blocks",
    order: 6,
    features: ["model.subscribe", "transient", "commands-to", "undo"],
    docs: "/docs/guides/undo-redo",
} satisfies ExampleMeta;
