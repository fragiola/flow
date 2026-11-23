// How this example looks: one class string per part, read from the theme's --fl-* tokens and the
// Fragiola palette roles, so the five example themes restyle it without touching the markup. The
// exported file takes the same look: download.ts reads these parts' computed styles at click time.

export const styles = {
    root: "size-full min-h-0 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
    edge: "fill-none stroke-(--fl-edge-color) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)] data-selected:stroke-(--fl-edge-selected) data-selected:stroke-(length:--fl-edge-selected-width)",
    /** the node's element: no frame of its own, so its box is the declared one */
    node: "group select-none data-dragging:cursor-grabbing focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line)",
    /** the frame, drawn inside the node's box (the export reads its colours) */
    card: "palette-raised box-border flex size-full items-center justify-center whitespace-nowrap rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) p-(--fl-node-padding) text-center font-(--fl-title-weight) shadow-(--fl-node-shadow) transition-[border-color,box-shadow] duration-(--fl-motion) group-data-selected:border-(--fl-edge-selected) group-data-selected:ring-(length:--fl-focus-width) group-data-selected:ring-(--fl-edge-selected)/30",
    handle: "size-(--fl-handle-size) rounded-(--fl-handle-radius) border-(length:--fl-handle-border) border-(--fl-handle-line) bg-(--fl-handle-bg)",
    panel: "palette-raised absolute top-3 start-3 flex flex-wrap items-center gap-2 rounded-(--fl-control-radius) border border-palette-line bg-palette-base p-2 shadow-(--fl-node-shadow)",
    button: "flex h-8 items-center gap-1.5 rounded-(--fl-control-radius) border border-palette-line px-3 text-sm text-palette-accent hover:bg-palette-soft focus-visible:outline-2 focus-visible:outline-palette-ring [&_svg]:size-4",
    primary:
        "palette-blue flex h-8 items-center gap-1.5 rounded-(--fl-control-radius) bg-palette-base px-3 text-sm font-medium text-palette-contrast hover:bg-palette-base-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-palette-ring [&_svg]:size-4",
    message: "basis-full px-1 text-xs text-palette-accent/85",
};
