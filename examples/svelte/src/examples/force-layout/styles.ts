// How this example looks: one class string per part, read from the theme's --fl-* tokens and the
// Fragiola palette roles, so the five example themes restyle it without touching the markup. The
// nodes are fixed boxes (the size the collision keeps apart), their label centred; a pinned one
// shows a pin at its corner and a dashed accent border. The edges run from centre to centre, under
// the nodes.

export const styles = {
    root: "size-full min-h-0 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
    node: "palette-raised relative box-border flex select-none items-center justify-center whitespace-nowrap rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) text-center font-(--fl-title-weight) shadow-(--fl-node-shadow) transition-[border-color,box-shadow] duration-(--fl-motion) data-dragging:cursor-grabbing data-pinned:border-dashed data-pinned:border-(--fl-edge-selected) data-selected:border-(--fl-edge-selected) data-selected:ring-(length:--fl-focus-width) data-selected:ring-(--fl-edge-selected)/30 focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line)",
    /** the pin at a pinned node's corner */
    pin: "palette-raised absolute -end-2 -top-2 flex size-5 items-center justify-center rounded-full border border-palette-line bg-palette-base text-(--fl-edge-selected) [&_svg]:size-3",
    edge: "fill-none stroke-(--fl-edge-color) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)] data-selected:stroke-(--fl-edge-selected) data-selected:stroke-(length:--fl-edge-selected-width)",
    edgeGroup:
        "cursor-pointer outline-none focus-visible:[&>[data-flow-part=edge-path]]:stroke-(--fl-focus-line)",
    /** the status and the Restart button, over the flow */
    panel: "palette-raised absolute bottom-3 start-1/2 flex -translate-x-1/2 items-center gap-3 rounded-(--fl-control-radius) border border-palette-line bg-palette-base px-3 py-2 text-sm shadow-(--fl-node-shadow)",
    status: "min-w-20 text-palette-accent",
    button: "flex h-8 items-center gap-1.5 rounded-(--fl-control-radius) border border-palette-line px-3 text-sm text-palette-accent hover:bg-palette-soft focus-visible:outline-2 focus-visible:outline-palette-ring [&_svg]:size-4",
};
