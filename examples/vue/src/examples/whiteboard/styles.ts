// How this example looks: one class string per part, read from the theme's --fl-* tokens and the
// Fragiola palette roles, so the five example themes restyle it without touching the markup. The
// drawing layer covers the flow and takes the pointer (no touch scrolling) while a drawing tool is
// active; the cursor says which tool it is (`data-tool` on the root). A node or edge the eraser
// is wiping over fades (`data-erasing`) until the wipe ends and removes it.

export const styles = {
    root: "size-full min-h-0 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
    selectionBox: "border border-(--fl-selection-line) bg-(--fl-selection-bg)",
    edgeGroup:
        "outline-none transition-opacity duration-(--fl-motion) focus-visible:[&>[data-flow-part=edge-path]]:stroke-(--fl-focus-line) data-erasing:opacity-30",
    edge: "fill-none stroke-(--fl-edge-color) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)] data-selected:stroke-(--fl-edge-selected) data-selected:stroke-(length:--fl-edge-selected-width)",
    /** a rectangle: drawn, or one of the board's notes */
    shape: "palette-raised grid select-none place-items-center rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) p-(--fl-node-padding) text-center font-(--fl-title-weight) shadow-(--fl-node-shadow) transition-[border-color,box-shadow,opacity] duration-(--fl-motion) data-dragging:cursor-grabbing data-selected:border-(--fl-edge-selected) data-selected:ring-(length:--fl-focus-width) data-selected:ring-(--fl-edge-selected)/30 focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line) data-erasing:opacity-30",
    /** a freehand stroke: no frame, a dashed one while selected */
    stroke: "palette-blue rounded-(--fl-node-radius) outline-none transition-opacity duration-(--fl-motion) data-selected:outline-(length:--fl-focus-width) data-selected:outline-dashed data-selected:outline-(--fl-edge-selected) focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-(--fl-focus-line) data-erasing:opacity-30",
    strokeSvg:
        "pointer-events-none absolute inset-0 size-full overflow-visible",
    strokePath:
        "fill-none stroke-palette-accent [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:4]",
    handle: "size-(--fl-handle-size) rounded-(--fl-handle-radius) border-(length:--fl-handle-border) border-(--fl-handle-line) bg-(--fl-handle-bg)",
    /** the drawing layer over the flow, while a drawing tool is active */
    layer: "absolute inset-0 touch-none select-none [[data-tool=eraser]_&]:cursor-cell [[data-tool=freehand]_&]:cursor-crosshair [[data-tool=lasso]_&]:cursor-crosshair [[data-tool=rectangle]_&]:cursor-crosshair",
    preview: "pointer-events-none absolute inset-0 size-full overflow-visible",
    previewRect:
        "fill-(--fl-selection-bg) stroke-(--fl-selection-line) [stroke-dasharray:6_4] [stroke-width:1.5]",
    previewStroke:
        "palette-blue fill-none stroke-palette-accent [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:4]",
    previewTrail:
        "fill-none stroke-(--fl-grid-color) [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:12] opacity-60",
    previewLasso:
        "fill-(--fl-selection-bg) stroke-(--fl-selection-line) [stroke-dasharray:6_4] [stroke-width:1.5]",
    /** the tools, the hint and the status, over the flow */
    panel: "palette-raised absolute top-3 start-1/2 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-col items-center gap-1 rounded-(--fl-control-radius) border border-palette-line bg-palette-base px-2 py-1.5 text-sm shadow-(--fl-node-shadow)",
    tools: "flex items-center gap-1",
    tool: "grid size-8 place-items-center rounded-(--fl-control-radius) text-palette-contrast hover:bg-palette-base-hover focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line) aria-pressed:bg-palette-soft aria-pressed:text-palette-accent [&_svg]:size-4",
    hint: "text-center text-xs text-palette-accent",
    status: "text-center text-xs empty:hidden",
};
