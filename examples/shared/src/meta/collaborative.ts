import type { ExampleMeta } from "../meta-types";

export default {
    title: "Collaborative",
    description:
        "Alice and Bob edit one document side by side: each local command is sent over a transport and applied on the other side (a drag streams as it goes), with the other's cursor and selection shown; a BroadcastChannel joins other tabs.",
    level: "data",
    order: 4,
    features: [
        "model.subscribe",
        "commands-to",
        "batch",
        "meta",
        "transient",
        "screen-to-flow",
        "BroadcastChannel",
    ],
    docs: "/docs/guides/undo-redo",
} satisfies ExampleMeta;
