// How this example looks: one class string per part, read from the theme's --fl-* tokens and the
// Fragiola palette roles, so the five example themes restyle it without touching the markup. The
// nodes are kept cheap to draw: one element, its declared box, no transition.

export const styles = {
    /** the example's frame: the flow and, over it, the panel */
    frame: "relative size-full min-h-0",
    root: "size-full min-h-0 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
    node: "palette-raised box-border flex select-none items-center justify-center whitespace-nowrap rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) text-center text-xs font-(--fl-title-weight) shadow-(--fl-node-shadow) data-dragging:cursor-grabbing data-selected:border-(--fl-edge-selected) focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line)",
    edge: "fill-none stroke-(--fl-edge-color) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)] data-selected:stroke-(--fl-edge-selected) data-selected:stroke-(length:--fl-edge-selected-width)",
    edgeGroup:
        "outline-none focus-visible:[&>[data-flow-part=edge-path]]:stroke-(--fl-focus-line)",
    panel: "palette-raised absolute top-3 start-3 end-3 flex flex-wrap items-center gap-2 rounded-(--fl-control-radius) border border-palette-line bg-palette-base p-2 text-sm text-palette-contrast shadow-(--fl-node-shadow) sm:end-auto",
    field: "flex items-center gap-2 text-palette-accent",
    select: "h-8 rounded-(--fl-control-radius) border border-palette-line bg-palette-base px-2 text-palette-contrast focus-visible:outline-2 focus-visible:outline-palette-ring",
    button: "palette-blue flex h-8 items-center gap-1.5 rounded-(--fl-control-radius) bg-palette-base px-3 font-medium text-palette-contrast hover:bg-palette-base-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-palette-ring [&_svg]:size-4",
    readout:
        "flex basis-full flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-palette-accent/85",
    stat: "flex gap-1",
    value: "font-medium tabular-nums text-palette-contrast",
};
