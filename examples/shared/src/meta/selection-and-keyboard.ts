import type { ExampleMeta } from "../meta-types";

export default {
    title: "Selection and keyboard",
    description:
        "Click, Shift-click and box-select nodes and edges; Tab through them, move them with the arrows, delete them, and connect handles with Enter.",
    level: "interaction",
    order: 1,
    features: [
        "selection()",
        "keyboard()",
        "keyboard connection",
        "Flow.SelectionBox",
        "useSelection",
        "selection.remove",
    ],
    docs: "/docs/guides/selection",
} satisfies ExampleMeta;
