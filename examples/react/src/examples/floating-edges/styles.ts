// How this example looks: one class string (or function of an app value) per part, read from the
// theme's --fl-* tokens and the Fragiola palette roles, so the five example themes restyle it
// without touching the markup. A round node is the ellipse of its box (`rounded-[50%]`): the
// shape its floating edges cut at.

import type { Shape } from "./border-intersection";

const SHAPE: Record<Shape, string> = {
    rect: "rounded-(--fl-node-radius)",
    ellipse: "rounded-[50%]",
};

export const styles = {
    root: "size-full min-h-0 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
    edgeGroup:
        "cursor-pointer outline-none focus-visible:[&>[data-flow-part=edge-path]]:stroke-(--fl-focus-line)",
    edgeHit: "fill-none stroke-transparent stroke-[16px]",
    edge: "fill-none stroke-(--fl-edge-color) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)] data-selected:stroke-(--fl-edge-selected) data-selected:stroke-(length:--fl-edge-selected-width)",
    /** the dot where an edge meets a border */
    end: "pointer-events-none fill-(--fl-edge-color) [[data-selected]>&]:fill-(--fl-edge-selected)",
    /** a node, in the shape of its border */
    node: (shape: Shape) =>
        `${SHAPE[shape]} palette-raised grid select-none place-items-center border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) p-(--fl-node-padding) text-center font-(--fl-title-weight) shadow-(--fl-node-shadow) transition-[border-color,box-shadow] duration-(--fl-motion) data-dragging:cursor-grabbing data-selected:border-(--fl-edge-selected) data-selected:ring-(length:--fl-focus-width) data-selected:ring-(--fl-edge-selected)/30 focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line)`,
    /** the variant chooser, over the flow */
    panel: "palette-raised absolute bottom-3 start-1/2 flex -translate-x-1/2 items-center gap-3 rounded-(--fl-control-radius) border border-palette-line bg-palette-base px-3 py-2 text-sm shadow-(--fl-node-shadow)",
    legend: "float-start me-1 font-semibold",
    option: "flex cursor-pointer items-center gap-1.5 text-palette-accent has-checked:text-palette-contrast has-checked:font-semibold",
    radio: "size-3.5 accent-(--fl-edge-selected) focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line)",
};
