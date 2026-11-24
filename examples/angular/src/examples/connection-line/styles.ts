// How this example looks: one class string per part, read from the theme's --fl-* tokens and the
// Fragiola palette roles, so the five example themes restyle it without touching the markup. The
// connection line is the `group`: its lines and its end read its `data-valid` / `data-invalid`.

export const styles = {
    root: "size-full min-h-0 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
    /** a node; a locked one has a dashed border and takes no new edge */
    node: (locked: boolean) =>
        `${locked ? "border-dashed text-palette-accent" : ""} palette-raised grid select-none place-items-center rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) px-(--fl-node-padding) font-(--fl-title-weight) shadow-(--fl-node-shadow) transition-[border-color,box-shadow] duration-(--fl-motion) data-dragging:cursor-grabbing data-selected:border-(--fl-edge-selected) data-selected:ring-(length:--fl-focus-width) data-selected:ring-(--fl-edge-selected)/30 focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line)`,
    handle: "size-(--fl-handle-size) cursor-crosshair rounded-(--fl-handle-radius) border-(length:--fl-handle-border) border-(--fl-handle-line) bg-(--fl-handle-bg) data-valid:border-(--fl-valid) data-valid:bg-(--fl-valid) data-invalid:border-(--fl-invalid) data-invalid:bg-(--fl-invalid) focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line)",
    edge: "fill-none stroke-(--fl-edge-color) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)] data-selected:stroke-(--fl-edge-selected) data-selected:stroke-(length:--fl-edge-selected-width)",
    edgeGroup:
        "cursor-pointer outline-none focus-visible:[&>[data-flow-part=edge-path]]:stroke-(--fl-focus-line)",
    /** the connection line's svg: its children read its validity */
    connection: "group/line",
    /** the line from the handle pressed: thick, in the selection's colour until a target says */
    line: "fill-none stroke-(--fl-edge-selected) stroke-[calc(var(--fl-edge-width)*2)] [stroke-linecap:round] group-data-valid/line:stroke-(--fl-valid) group-data-invalid/line:stroke-(--fl-invalid) group-data-invalid/line:[stroke-dasharray:4_6]",
    /** a line from another selected node: thinner, the same colours */
    extra: "fill-none stroke-(--fl-edge-selected) stroke-(length:--fl-edge-width) opacity-70 [stroke-linecap:round] group-data-valid/line:stroke-(--fl-valid) group-data-invalid/line:stroke-(--fl-invalid) group-data-invalid/line:[stroke-dasharray:4_6]",
    /** the ring at the line's end */
    end: "fill-(--fl-canvas-bg) stroke-(--fl-edge-selected) stroke-(length:--fl-edge-width) group-data-valid/line:fill-(--fl-valid) group-data-valid/line:stroke-(--fl-valid) group-data-invalid/line:fill-(--fl-invalid) group-data-invalid/line:stroke-(--fl-invalid)",
    status: "palette-raised absolute top-3 start-3 max-w-80 rounded-(--fl-control-radius) border border-palette-line bg-palette-base px-2.5 py-1.5 text-xs text-palette-accent shadow-(--fl-node-shadow)",
};
