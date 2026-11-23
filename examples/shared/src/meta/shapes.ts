import type { ExampleMeta } from "../meta-types";

export default {
    title: "Shapes",
    description:
        "Flowchart shapes drawn as SVG inside each node, picked from its toolbar, resized from its corners, turned from a rotation knob (its handles turning with it) and relabelled in place.",
    level: "nodes",
    order: 2,
    features: [
        "SVG shapes",
        "node.set-data",
        "rotation in data",
        "NodeResizer",
        "Flow.NodeToolbar",
        "edit in place",
    ],
    docs: "/docs/guides/custom-nodes",
    height: 520,
} satisfies ExampleMeta;
