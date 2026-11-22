// How this example looks: one class string (or state function) per part, read from the theme's
// --fl-* tokens and the Fragiola palette roles, so the five example themes restyle it without
// touching the markup.

export const styles = {
    remove: "palette-danger grid size-6 place-items-center rounded-full bg-palette-base text-palette-contrast shadow-(--fl-node-shadow) hover:bg-palette-base-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-palette-ring [&_svg]:size-3.5",
    toolbar:
        "palette-raised flex items-center gap-1 rounded-(--fl-control-radius) border border-palette-line bg-palette-base p-1 shadow-(--fl-node-shadow)",
    action: "grid size-7 place-items-center rounded-(--fl-control-radius) text-palette-accent hover:bg-palette-soft focus-visible:outline-2 focus-visible:outline-palette-ring [&_svg]:size-4",
    danger: "palette-danger grid size-7 place-items-center rounded-(--fl-control-radius) text-palette-accent hover:bg-palette-soft focus-visible:outline-2 focus-visible:outline-palette-ring [&_svg]:size-4",
    edgeGroup: "cursor-pointer",
    edgeHit: "fill-none stroke-transparent stroke-[16px]",
    edge: "fill-none stroke-(--fl-edge-color) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)] data-selected:stroke-(--fl-edge-selected) data-selected:stroke-(length:--fl-edge-selected-width)",
    label: "flex items-center",
    text: "palette-raised rounded-(--fl-control-radius) border border-(--fl-node-line) bg-palette-base px-1.5 py-0.5 text-xs text-palette-accent",
    /** the badge's palette: green when passing, danger when failing */
    status: (status: "passing" | "failing" | undefined) =>
        status === "failing" ? "palette-danger" : "palette-green",
    root: "size-full min-h-0 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
    node: "palette-raised min-w-28 select-none rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) p-(--fl-node-padding) text-center font-(--fl-title-weight) shadow-(--fl-node-shadow) transition-[border-color,box-shadow] duration-(--fl-motion) data-dragging:cursor-grabbing data-selected:border-(--fl-edge-selected) data-selected:ring-(length:--fl-focus-width) data-selected:ring-(--fl-edge-selected)/30 focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line)",
    handle: "size-(--fl-handle-size) cursor-crosshair rounded-(--fl-handle-radius) border-(length:--fl-handle-border) border-(--fl-handle-line) bg-(--fl-handle-bg) data-valid:bg-(--fl-valid) data-invalid:bg-(--fl-invalid)",
    connection:
        "fill-none stroke-(--fl-edge-selected) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)]",
};
