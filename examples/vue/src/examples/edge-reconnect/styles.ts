// How this example looks: one class string (or state function) per part, read from the theme's
// --fl-* tokens and the Fragiola palette roles, so the five example themes restyle it without
// touching the markup.

export const styles = {
    root: "size-full min-h-0 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
    edge: "fill-none stroke-(--fl-edge-color) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)] data-selected:stroke-(--fl-edge-selected) data-selected:stroke-(length:--fl-edge-selected-width)",
    edgeGroup:
        "cursor-pointer outline-none focus-visible:[&>[data-flow-part=edge-path]:last-child]:stroke-(--fl-focus-line)",
    label: "palette-raised rounded-(--fl-control-radius) border border-(--fl-node-line) bg-palette-base px-1.5 py-0.5 text-xs text-palette-accent/85",
    anchor: "fill-transparent stroke-transparent stroke-(length:--fl-edge-width) [[data-flow-part=edge]:hover_&]:fill-(--fl-handle-bg) [[data-flow-part=edge]:hover_&]:stroke-(--fl-edge-selected) cursor-move",
    node: "palette-raised min-w-28 select-none rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) p-(--fl-node-padding) text-center font-(--fl-title-weight) shadow-(--fl-node-shadow) transition-[border-color,box-shadow] duration-(--fl-motion) data-dragging:cursor-grabbing data-selected:border-(--fl-edge-selected) data-selected:ring-(length:--fl-focus-width) data-selected:ring-(--fl-edge-selected)/30 focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line)",
    handle: "size-(--fl-handle-size) cursor-crosshair rounded-(--fl-handle-radius) border-(length:--fl-handle-border) border-(--fl-handle-line) bg-(--fl-handle-bg) data-valid:bg-(--fl-valid) data-invalid:bg-(--fl-invalid)",
    connection:
        "fill-none stroke-(--fl-edge-selected) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)]",
    option: "palette-raised absolute top-3 start-3 flex items-center gap-2 rounded-(--fl-control-radius) border border-palette-line bg-palette-base px-2.5 py-1.5 text-sm text-palette-accent shadow-(--fl-node-shadow) select-none",
    switch: "relative h-4 w-7 shrink-0 cursor-pointer appearance-none rounded-full bg-palette-line transition-colors duration-(--fl-motion) before:absolute before:top-0.5 before:start-0.5 before:size-3 before:rounded-full before:bg-palette-base before:transition-transform before:duration-(--fl-motion) checked:bg-(--fl-edge-selected) checked:before:translate-x-3 rtl:checked:before:-translate-x-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-palette-ring",
};
