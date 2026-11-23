// How this example looks: one class string (or state function) per part, read from the theme's
// --fl-* tokens and the Fragiola palette roles, so the five example themes restyle it without
// touching the markup.

export const styles = {
    group: "palette-surface select-none rounded-(--fl-node-radius) border-(length:--fl-node-border) border-dashed border-palette-accent/50 bg-palette-base/40 data-selected:border-(--fl-edge-selected) data-dragging:cursor-grabbing",
    groupTitle:
        "absolute top-2 start-3 text-xs font-(--fl-title-weight) uppercase tracking-wide text-palette-accent/85",
    node: "palette-raised min-w-28 select-none rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) p-(--fl-node-padding) text-center font-(--fl-title-weight) shadow-(--fl-node-shadow) transition-[border-color,box-shadow] duration-(--fl-motion) data-dragging:cursor-grabbing data-selected:border-(--fl-edge-selected) data-selected:ring-(length:--fl-focus-width) data-selected:ring-(--fl-edge-selected)/30 focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line)",
    handle: "size-(--fl-handle-size) cursor-crosshair rounded-(--fl-handle-radius) border-(length:--fl-handle-border) border-(--fl-handle-line) bg-(--fl-handle-bg) data-valid:bg-(--fl-valid) data-invalid:bg-(--fl-invalid)",
    root: "size-full min-h-0 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
    edge: "fill-none stroke-(--fl-edge-color) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)] data-selected:stroke-(--fl-edge-selected) data-selected:stroke-(length:--fl-edge-selected-width)",
    toolbar:
        "palette-raised absolute top-3 start-3 flex gap-1 rounded-(--fl-control-radius) border border-palette-line bg-palette-base p-1 shadow-(--fl-node-shadow)",
    button: "rounded-(--fl-control-radius) px-2.5 py-1 text-sm text-palette-accent hover:bg-palette-soft disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-palette-ring",
};
