// How this example looks: one class string per part, read from the theme's --fl-* tokens and the
// Fragiola palette roles, so the five example themes restyle it without touching the markup. A
// control point takes presses of its own (`pointer-events-auto`, no touch scrolling) inside an
// edge that otherwise takes them on its stroke only.

export const styles = {
    root: "size-full min-h-0 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
    edgeGroup:
        "cursor-pointer outline-none focus-visible:[&>[data-flow-part=edge-path]]:stroke-(--fl-focus-line)",
    edgeHit: "fill-none stroke-transparent stroke-[16px]",
    edge: "fill-none stroke-(--fl-edge-color) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)] data-selected:stroke-(--fl-edge-selected) data-selected:stroke-(length:--fl-edge-selected-width)",
    /** a control point: a handle on the edge, grabbed to bend it */
    point: "pointer-events-auto cursor-grab touch-none fill-(--fl-node-bg) stroke-(--fl-edge-color) stroke-2 outline-none transition-[stroke-width] duration-(--fl-motion) hover:stroke-(--fl-edge-selected) focus-visible:stroke-(--fl-focus-line) focus-visible:stroke-[3px] data-dragging:cursor-grabbing data-dragging:fill-(--fl-edge-selected) [[data-selected]>&]:stroke-(--fl-edge-selected)",
    node: "palette-raised grid select-none place-items-center rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) p-(--fl-node-padding) text-center font-(--fl-title-weight) shadow-(--fl-node-shadow) transition-[border-color,box-shadow] duration-(--fl-motion) data-dragging:cursor-grabbing data-selected:border-(--fl-edge-selected) data-selected:ring-(length:--fl-focus-width) data-selected:ring-(--fl-edge-selected)/30 focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line)",
    handle: "size-(--fl-handle-size) rounded-(--fl-handle-radius) border-(length:--fl-handle-border) border-(--fl-handle-line) bg-(--fl-handle-bg)",
    /** the actions and the hint, over the flow */
    panel: "palette-raised absolute bottom-3 start-1/2 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-col items-center gap-1 rounded-(--fl-control-radius) border border-palette-line bg-palette-base px-3 py-2 text-sm shadow-(--fl-node-shadow)",
    actions: "flex items-center gap-2",
    action: "flex items-center gap-1.5 rounded-(--fl-control-radius) px-2 py-1 font-semibold text-palette-accent hover:bg-palette-soft focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line) [&_svg]:size-4",
    hint: "text-center text-xs text-palette-accent",
    status: "text-center text-xs empty:hidden",
};
