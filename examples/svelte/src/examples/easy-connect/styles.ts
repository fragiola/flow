// How this example looks: one class string per part, read from the theme's --fl-* tokens and the
// Fragiola palette roles, so the five example themes restyle it without touching the markup. The
// handles are sized from the theme's handle size, and grow on a coarse pointer (a finger).

export const styles = {
    node: "palette-raised select-none rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) shadow-(--fl-node-shadow) data-selected:border-(--fl-edge-selected) focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-4 focus-visible:outline-(--fl-focus-line)",
    /** the whole node, invisible: lit when a connection would end here */
    target: "pointer-events-none inset-0 rounded-(--fl-node-radius) data-valid:outline-(length:--fl-focus-width) data-valid:outline-(--fl-valid) data-invalid:outline-(length:--fl-focus-width) data-invalid:outline-(--fl-invalid) focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-(--fl-focus-line)",
    /** the ring around the body, invisible until hovered: a press here connects */
    source: "inset-[calc(var(--fl-handle-size)*-0.5)] cursor-crosshair touch-none rounded-[calc(var(--fl-node-radius)+var(--fl-handle-size)*0.5)] hover:bg-(--fl-edge-selected)/15 data-connecting:bg-(--fl-edge-selected)/25 data-valid:outline-(length:--fl-focus-width) data-valid:outline-(--fl-valid) data-invalid:outline-(length:--fl-focus-width) data-invalid:outline-(--fl-invalid) focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-(--fl-focus-line) pointer-coarse:inset-[calc(var(--fl-handle-size)*-1.25)] pointer-coarse:rounded-[calc(var(--fl-node-radius)+var(--fl-handle-size)*1.25)]",
    /** the body inside the ring, in the node's colour (the lit ring shows around it): a press here drags the node */
    body: "absolute inset-[calc(var(--fl-handle-size)*0.75)] grid bg-(--fl-node-bg) cursor-grab place-items-center rounded-(--fl-control-radius) font-(--fl-title-weight) pointer-coarse:inset-[calc(var(--fl-handle-size)*1.5)] [[data-dragging]>&]:cursor-grabbing",
    connection:
        "fill-none stroke-(--fl-edge-selected) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)]",
    edge: "fill-none stroke-(--fl-edge-color) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)] data-selected:stroke-(--fl-edge-selected) data-selected:stroke-(length:--fl-edge-selected-width)",
    edgeGroup:
        "cursor-pointer outline-none focus-visible:[&>[data-flow-part=edge-path]:last-child]:stroke-(--fl-focus-line)",
    edgeHit: "fill-none stroke-transparent stroke-[16px]",
    root: "size-full min-h-0 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
    hint: "absolute bottom-3 start-3 text-xs text-palette-accent/85",
};
