import type { ExampleMeta } from "../meta-types";

export default {
    title: "Edge markers",
    description:
        "Arrowheads, open arrows, circles and diamonds at either end of an edge: plain SVG markers the example defines, coloured by the edge's tone and the theme, with a marker of the selection's colour for a selected edge.",
    level: "edges",
    order: 3,
    features: [
        "SVG marker",
        "markerStart / markerEnd",
        "Flow.EdgePath",
        "data-selected",
        "useId",
    ],
    docs: "/docs/guides/custom-edges#arrowheads",
} satisfies ExampleMeta;
