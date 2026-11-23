// How this example looks: one class string (or function of an app value) per part, read from the
// theme's --fl-* tokens and the Fragiola palette roles, so the five example themes restyle it
// without touching the markup. Every colour of a gradient is a palette's accent: a node captures
// its first palette's accent as `--gradient-from`, its frame its second one as `--gradient-to` (a
// custom property keeps the value of the palette it was set in, and its children inherit it), and
// each stop of an edge's `<linearGradient>` sits in its own palette and reads its accent.

import type { Kind, Tone } from "./gradients";

/** A node's own palette, captured as `--gradient-from` (classes are complete literals). */
const FROM: Record<Kind, string> = {
    source: "palette-blue [--gradient-from:var(--palette-accent)]",
    transform: "palette-purple [--gradient-from:var(--palette-accent)]",
    check: "palette-orange [--gradient-from:var(--palette-accent)]",
    output: "palette-green [--gradient-from:var(--palette-accent)]",
};

/** A node's second palette, captured as `--gradient-to` on the frame that paints the border. */
const TO: Record<Kind, string> = {
    source: "palette-green [--gradient-to:var(--palette-accent)]",
    transform: "palette-blue [--gradient-to:var(--palette-accent)]",
    check: "palette-purple [--gradient-to:var(--palette-accent)]",
    output: "palette-orange [--gradient-to:var(--palette-accent)]",
};

/** A gradient stop: its palette's accent. */
const STOP: Record<Tone, string> = {
    blue: "palette-blue [stop-color:var(--palette-accent)]",
    green: "palette-green [stop-color:var(--palette-accent)]",
    orange: "palette-orange [stop-color:var(--palette-accent)]",
    purple: "palette-purple [stop-color:var(--palette-accent)]",
};

export const styles = {
    root: "size-full min-h-0 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
    /** a stop of an edge's gradient, in its palette's accent */
    stop: (tone: Tone) => STOP[tone],
    edgeGroup:
        "cursor-pointer outline-none focus-visible:[&>[data-flow-part=edge-path]:last-child]:stroke-(--fl-focus-line)",
    edgeHit: "fill-none stroke-transparent stroke-[16px]",
    /**
     * the visible path: its stroke is its gradient (the `stroke` attribute), under a soft shadow;
     * selected, it widens and the shadow takes the selection's colour
     */
    edge: "fill-none stroke-(length:--fl-edge-selected-width) [stroke-dasharray:var(--fl-edge-dash)] [stroke-linecap:round] [filter:drop-shadow(0_2px_3px_color-mix(in_oklab,var(--fl-edge-color)_45%,transparent))] data-selected:[stroke-width:calc(var(--fl-edge-selected-width)*1.75)] data-selected:[filter:drop-shadow(0_0_4px_var(--fl-edge-selected))]",
    /** the node: its own palette's accent glows around it once selected */
    node: (kind: Kind) =>
        `${FROM[kind]} min-w-48 select-none rounded-(--fl-node-radius) shadow-(--fl-node-shadow) transition-shadow duration-(--fl-motion) data-dragging:cursor-grabbing data-selected:shadow-[0_0_0_1px_var(--gradient-from),0_0_22px_4px_color-mix(in_oklab,var(--gradient-from)_55%,transparent)] focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-3 focus-visible:outline-(--fl-focus-line)`,
    /** the gradient border: a frame whose padding is the border's width, from one palette to the other */
    frame: (kind: Kind) =>
        `${TO[kind]} rounded-[inherit] bg-linear-to-br from-(--gradient-from) to-(--gradient-to) p-0.5`,
    body: "palette-raised flex items-center gap-3 rounded-[max(0px,calc(var(--fl-node-radius)-2px))] bg-(--fl-node-bg) p-(--fl-node-padding) text-left text-palette-contrast",
    /** the icon's tile: a wash of the node's gradient, the icon in its own colour */
    icon: "grid size-9 shrink-0 place-items-center rounded-[max(0px,calc(var(--fl-node-radius)-4px))] bg-linear-to-br from-(--gradient-from)/20 to-(--gradient-to)/20 text-(--gradient-from) [&_svg]:size-5",
    text: "flex min-w-0 flex-col whitespace-nowrap",
    title: "font-(--fl-title-weight) leading-tight",
    detail: "text-palette-contrast/70 text-xs leading-tight",
    handle: "size-(--fl-handle-size) rounded-(--fl-handle-radius) border-(length:--fl-handle-border) border-(--fl-handle-line) bg-(--fl-handle-bg)",
};
