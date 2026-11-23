// How this example looks: one class string (or function of an app value) per part, read from the
// theme's --fl-* tokens and the Fragiola palette roles, so the five example themes restyle it
// without touching the markup. An edge's stroke and its markers take its tone; selected, both take
// the selection's colour (the path swaps to the selected markers through `data-selected`).

import type { MarkerState, Tone } from "./markers";

const TONE: Record<Tone, string> = {
    neutral: "stroke-(--fl-edge-color)",
    blue: "palette-blue stroke-palette-accent",
    green: "palette-green stroke-palette-accent",
    orange: "palette-orange stroke-palette-accent",
    purple: "palette-purple stroke-palette-accent",
};

const MARKER: Record<MarkerState, string> = {
    neutral: "text-(--fl-edge-color)",
    blue: "palette-blue text-palette-accent",
    green: "palette-green text-palette-accent",
    orange: "palette-orange text-palette-accent",
    purple: "palette-purple text-palette-accent",
    selected: "text-(--fl-edge-selected)",
};

export const styles = {
    root: "size-full min-h-0 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
    /** the svg holding the markers: no size, out of the way */
    defs: "pointer-events-none absolute size-0 overflow-hidden",
    /** a marker, coloured by its tone or the selection; its shape reads `currentColor` */
    marker: (state: MarkerState) => MARKER[state],
    filled: "fill-current",
    outlined: "fill-(--fl-canvas-bg) stroke-current [stroke-width:1.5]",
    edgeGroup:
        "cursor-pointer outline-none focus-visible:[&>[data-flow-part=edge-path]]:stroke-(--fl-focus-line)",
    edgeHit: "fill-none stroke-transparent stroke-[16px]",
    /** the visible path in its tone; selected, the selected markers replace the tone's */
    edge: (tone: Tone) =>
        `${TONE[tone]} fill-none stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)] data-selected:stroke-(--fl-edge-selected) data-selected:stroke-(length:--fl-edge-selected-width) data-selected:[marker-start:var(--marker-start-selected)] data-selected:[marker-end:var(--marker-end-selected)]`,
    node: "palette-raised min-w-28 select-none rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) p-(--fl-node-padding) text-center font-(--fl-title-weight) shadow-(--fl-node-shadow) transition-[border-color,box-shadow] duration-(--fl-motion) data-dragging:cursor-grabbing data-selected:border-(--fl-edge-selected) data-selected:ring-(length:--fl-focus-width) data-selected:ring-(--fl-edge-selected)/30 focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line)",
    handle: "size-(--fl-handle-size) rounded-(--fl-handle-radius) border-(length:--fl-handle-border) border-(--fl-handle-line) bg-(--fl-handle-bg)",
};
