import type { ExampleMeta } from "../meta-types";

export default {
    title: "Server-rendered flow",
    description:
        "Nodes that declare their size and handles, so their edges are drawn before anything is measured: in the server's HTML and the first render, with nothing moving once measured.",
    level: "basics",
    order: 7,
    features: [
        "width / height",
        "handles",
        "initialWidth",
        "targetPosition",
        "origin",
        "staticGeometry",
    ],
    docs: "/docs/concepts/nodes-and-edges",
} satisfies ExampleMeta;
