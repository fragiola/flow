// How this example looks: one class string (or state function) per part, read from the theme's
// --fl-* tokens and the Fragiola palette roles, so the five example themes restyle it without
// touching the markup.

export const styles = {
    root: "min-h-0 flex-1 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
    node: "palette-raised min-w-28 select-none rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) p-(--fl-node-padding) text-center font-(--fl-title-weight) shadow-(--fl-node-shadow) transition-[border-color,box-shadow] duration-(--fl-motion) data-dragging:cursor-grabbing data-selected:border-(--fl-edge-selected) data-selected:ring-(length:--fl-focus-width) data-selected:ring-(--fl-edge-selected)/30 focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line)",
    position:
        "mt-1 block text-xs font-normal tabular-nums text-palette-accent/85",
    layout: "flex size-full min-h-0 flex-col",
    toolbar:
        "palette-raised flex w-fit gap-0 overflow-hidden rounded-(--fl-control-radius) border border-palette-line bg-palette-base m-2 text-sm",
    legend: "sr-only",
    segment:
        "px-2.5 py-1 text-palette-accent not-last:border-e not-last:border-palette-line hover:bg-palette-soft aria-pressed:bg-palette-soft aria-pressed:font-semibold aria-pressed:text-palette-contrast focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-palette-ring",
};
