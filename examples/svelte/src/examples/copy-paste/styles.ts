// How this example looks: one class string per part, read from the theme's --fl-* tokens and the
// Fragiola palette roles, so the five example themes restyle it without touching the markup. A
// pasted node is selected, and shows it like any other.

export const styles = {
    root: "size-full min-h-0 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
    node: "palette-raised min-w-28 select-none rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) p-(--fl-node-padding) text-center font-(--fl-title-weight) shadow-(--fl-node-shadow) transition-[border-color,box-shadow] duration-(--fl-motion) data-dragging:cursor-grabbing data-selected:border-(--fl-edge-selected) data-selected:ring-(length:--fl-focus-width) data-selected:ring-(--fl-edge-selected)/30 focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line)",
    handle: "size-(--fl-handle-size) rounded-(--fl-handle-radius) border-(length:--fl-handle-border) border-(--fl-handle-line) bg-(--fl-handle-bg)",
    edge: "fill-none stroke-(--fl-edge-color) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)] data-selected:stroke-(--fl-edge-selected) data-selected:stroke-(length:--fl-edge-selected-width)",
    edgeGroup:
        "cursor-pointer outline-none focus-visible:[&>[data-flow-part=edge-path]]:stroke-(--fl-focus-line)",
    panel: "palette-raised absolute top-3 start-3 flex flex-wrap items-center gap-2 rounded-(--fl-control-radius) border border-palette-line bg-palette-base p-2 shadow-(--fl-node-shadow)",
    button: "flex h-8 items-center gap-1.5 rounded-(--fl-control-radius) border border-palette-line px-3 text-sm text-palette-accent hover:bg-palette-soft focus-visible:outline-2 focus-visible:outline-palette-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4",
    message: "basis-full px-1 text-xs text-palette-accent/85",
    hint: "absolute bottom-3 start-3 text-xs text-palette-accent/85",
};
