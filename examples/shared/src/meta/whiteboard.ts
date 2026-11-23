import type { ExampleMeta } from "../meta-types";

export default {
    title: "Whiteboard",
    description:
        "A toolbar of tools over the flow: draw rectangles and freehand strokes as nodes, wipe nodes and edges away with the eraser, and select the nodes inside a lasso; the pane does not pan while drawing.",
    level: "apps",
    order: 2,
    features: [
        "screen-to-flow",
        "panOnDrag",
        "node.add",
        "batch",
        "selection.set",
        "data-flow-no-gesture",
    ],
    height: 600,
} satisfies ExampleMeta;
