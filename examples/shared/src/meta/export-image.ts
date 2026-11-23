import type { ExampleMeta } from "../meta-types";

export default {
    title: "Export image",
    description:
        "Download the flow as an SVG built from its document alone with the core's static geometry (no DOM, so a server makes the same file), or as a PNG drawn from that SVG on a canvas.",
    level: "data",
    order: 5,
    features: [
        "staticGeometry",
        "flow-json",
        "width / height",
        "handles",
        "canvas.toBlob",
    ],
    docs: "/docs/guides/server-rendering",
} satisfies ExampleMeta;
