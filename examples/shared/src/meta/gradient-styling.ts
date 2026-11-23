import type { ExampleMeta } from "../meta-types";

export default {
    title: "Gradient styling",
    description:
        "An editor look of the app's own: gradient node borders, a glow on the selected node, edges stroked with a gradient under a soft shadow, and icons, every colour a palette's accent so it follows the theme.",
    level: "styling",
    order: 2,
    features: [
        "SVG linearGradient",
        "userSpaceOnUse",
        "useEdge",
        "data-selected",
        "palette roles",
        "useId",
    ],
    docs: "/docs/guides/styling-tailwind",
} satisfies ExampleMeta;
