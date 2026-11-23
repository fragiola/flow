import type { ExampleMeta } from "../meta-types";

export default {
    title: "Copy and paste",
    description:
        "Ctrl/⌘ + C, X and V (or the toolbar) copy, cut and paste the selected nodes and the edges between them, with new ids, offset on each paste or under the pointer; the clipboard is marked JSON, on the system clipboard when allowed and in memory otherwise.",
    level: "interaction",
    order: 6,
    features: [
        "useKeyPress",
        "batch",
        "selection.remove",
        "screen-to-flow",
        "flow-json",
        "validateFlow",
        "navigator.clipboard",
    ],
    docs: "/docs/guides/selection",
} satisfies ExampleMeta;
