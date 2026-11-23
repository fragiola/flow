// How this example looks: one class string per part, read from the theme's --fl-* tokens and the
// Fragiola palette roles, so the five example themes restyle it without touching the markup. A
// topic is a fixed box (the size dagre lays out): its label, and the collapse toggle at its end; a
// placeholder is a round "+" button under it, joined by a dashed edge.

export const styles = {
    root: "size-full min-h-0 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
    node: "palette-raised box-border flex select-none items-center gap-1 whitespace-nowrap rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) ps-3 pe-1.5 font-(--fl-title-weight) shadow-(--fl-node-shadow) transition-[border-color,box-shadow] duration-(--fl-motion) data-collapsed:border-dashed data-dragging:cursor-grabbing data-selected:border-(--fl-edge-selected) data-selected:ring-(length:--fl-focus-width) data-selected:ring-(--fl-edge-selected)/30 focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line)",
    label: "min-w-0 flex-1 truncate",
    /** the collapse / expand toggle at a topic's end */
    toggle: "flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-(--fl-control-radius) text-palette-accent hover:bg-palette-soft hover:text-palette-contrast focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-1 focus-visible:outline-(--fl-focus-line)",
    icon: "size-4",
    handle: "size-(--fl-handle-size) rounded-(--fl-handle-radius) border-(length:--fl-handle-border) border-(--fl-handle-line) bg-(--fl-handle-bg)",
    /** the placeholder node: only its button shows */
    placeholder: "box-border flex select-none items-center justify-center",
    /** where the dashed edge ends: on the button's top, not drawn */
    placeholderHandle: "size-px opacity-0",
    add: "palette-raised flex size-full cursor-pointer items-center justify-center rounded-full border border-palette-line border-dashed bg-palette-base text-palette-accent shadow-(--fl-node-shadow) hover:border-solid hover:text-palette-contrast focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line)",
    edge: "fill-none stroke-(--fl-edge-color) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)] data-selected:stroke-(--fl-edge-selected) data-selected:stroke-(length:--fl-edge-selected-width)",
    /** the edge to a placeholder: dashed, lighter */
    placeholderEdge:
        "fill-none stroke-(--fl-edge-color) stroke-(length:--fl-edge-width) opacity-60 [stroke-dasharray:4_4]",
    edgeGroup:
        "cursor-pointer outline-none focus-visible:[&>[data-flow-part=edge-path]]:stroke-(--fl-focus-line)",
};
