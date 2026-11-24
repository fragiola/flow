// How this example looks: one class string per part, read from the theme's --fl-* tokens and the
// Fragiola palette roles, so the five example themes restyle it without touching the markup. A
// node is a fixed box (the size ELK lays out): its title, then one row per port, the inputs on
// the left and the outputs on the right, each row holding its handle on the node's edge.

export const styles = {
    root: "size-full min-h-0 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
    node: "palette-raised box-border flex select-none flex-col whitespace-nowrap rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) shadow-(--fl-node-shadow) transition-[border-color,box-shadow] duration-(--fl-motion) data-dragging:cursor-grabbing data-selected:border-(--fl-edge-selected) data-selected:ring-(length:--fl-focus-width) data-selected:ring-(--fl-edge-selected)/30 focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line)",
    /** the node's name, one row of the header's height */
    title: "flex h-7 shrink-0 items-center justify-center font-(--fl-title-weight)",
    /** the two columns of ports: inputs, outputs */
    ports: "grid flex-1 grid-cols-2",
    column: "flex flex-col",
    /** one port's row: the offset parent of its handle, on the node's edge */
    inputRow:
        "relative flex h-5 items-center ps-2.5 text-xs text-palette-accent",
    outputRow:
        "relative flex h-5 items-center justify-end pe-2.5 text-xs text-palette-accent",
    handle: "size-(--fl-handle-size) rounded-(--fl-handle-radius) border-(length:--fl-handle-border) border-(--fl-handle-line) bg-(--fl-handle-bg)",
    edge: "fill-none stroke-(--fl-edge-color) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)] data-selected:stroke-(--fl-edge-selected) data-selected:stroke-(length:--fl-edge-selected-width)",
    edgeGroup:
        "cursor-pointer outline-none focus-visible:[&>[data-flow-part=edge-path]]:stroke-(--fl-focus-line)",
    /** the algorithm chooser, over the flow */
    panel: "palette-raised absolute bottom-3 start-1/2 flex -translate-x-1/2 items-center gap-3 rounded-(--fl-control-radius) border border-palette-line bg-palette-base px-3 py-2 text-sm shadow-(--fl-node-shadow)",
    legend: "float-start me-1 font-semibold",
    option: "flex cursor-pointer items-center gap-1.5 text-palette-accent has-checked:text-palette-contrast has-checked:font-semibold",
    radio: "size-3.5 accent-(--fl-edge-selected) focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line)",
};
