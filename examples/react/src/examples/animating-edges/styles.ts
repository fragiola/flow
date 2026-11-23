// How this example looks: one class string (or function of an app value) per part, read from the
// theme's --fl-* tokens and the Fragiola palette roles, so the five example themes restyle it
// without touching the markup. The motion itself is SVG (`animateMotion`, `animate`) in the markup;
// the pulse is the theme's `animate-pulse`, run once (`data-pulsing`), its length scaled by the
// app's motion level (0 under reduced motion).

import type { Motion } from "./motion";

const TONE: Record<Motion, string> = {
    travel: "palette-blue stroke-palette-accent",
    // the dash pattern is DASH in motion.ts: 8 flow pixels, then a gap of 6
    dash: "palette-green stroke-palette-accent [stroke-dasharray:8_6]",
    pulse: "palette-orange stroke-palette-accent group-data-pulsing:stroke-(length:--fl-edge-selected-width)",
};

export const styles = {
    root: "size-full min-h-0 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
    /** an edge's group; a pulsing one fades out and back once */
    edgeGroup:
        "group cursor-pointer outline-none focus-visible:[&>[data-flow-part=edge-path]:nth-of-type(2)]:stroke-(--fl-focus-line) data-pulsing:animate-pulse data-pulsing:[animation-iteration-count:1]!",
    edgeHit: "fill-none stroke-transparent stroke-[16px]",
    /** the visible path, in the tone of what it does */
    edge: (motion: Motion) =>
        `${TONE[motion]} fill-none stroke-(length:--fl-edge-width) data-selected:stroke-(--fl-edge-selected) data-selected:stroke-(length:--fl-edge-selected-width)`,
    /** the dot that travels along an edge */
    traveller:
        "palette-blue pointer-events-none fill-palette-accent stroke-(--fl-canvas-bg) [stroke-width:2]",
    node: "palette-raised min-w-28 select-none rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) p-(--fl-node-padding) text-center font-(--fl-title-weight) shadow-(--fl-node-shadow) transition-[border-color,box-shadow] duration-(--fl-motion) data-dragging:cursor-grabbing data-selected:border-(--fl-edge-selected) data-selected:ring-(length:--fl-focus-width) data-selected:ring-(--fl-edge-selected)/30 focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line)",
    body: "flex flex-col items-center gap-1.5",
    send: "palette-orange inline-flex items-center gap-1 rounded-(--fl-control-radius) bg-palette-base px-2 py-1 font-normal text-palette-contrast text-xs outline-none hover:bg-palette-base-hover focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line) disabled:opacity-60 [&_svg]:size-3.5",
    received: "font-normal text-palette-contrast/70 text-xs tabular-nums",
    handle: "size-(--fl-handle-size) rounded-(--fl-handle-radius) border-(length:--fl-handle-border) border-(--fl-handle-line) bg-(--fl-handle-bg)",
};
