// How this example looks: one class string (or state function) per part, read from the theme's
// --fl-* tokens and the Fragiola palette roles, so the five example themes restyle it without
// touching the markup.

export const styles = {
    /** the node itself: no frame of its own, the shape is its outline */
    node: "palette-raised group/node select-none rounded-(--fl-control-radius) data-dragging:cursor-grabbing focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-4 focus-visible:outline-(--fl-focus-line)",
    /** the turned content: the shape, the label, the knob and the handles */
    frame: "absolute inset-0 grid place-items-center",
    svg: "absolute inset-0 size-full overflow-visible",
    outline:
        "fill-(--fl-node-bg) stroke-(--fl-node-line) stroke-(length:--fl-node-border) group-data-selected/node:stroke-(--fl-edge-selected) group-data-resizing/node:stroke-(--fl-edge-selected)",
    label: "relative max-w-[80%] truncate px-1 text-center text-sm font-(--fl-title-weight)",
    field: "relative w-[80%] rounded-(--fl-control-radius) border border-palette-line bg-palette-base px-1 text-center text-sm outline-none focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-(--fl-focus-line)",
    /** the rotation knob above the content, shown while the node is selected */
    rotate: "invisible absolute -top-7 left-1/2 size-3.5 -translate-x-1/2 cursor-grab touch-none rounded-full border-(length:--fl-handle-border) border-(--fl-edge-selected) bg-(--fl-handle-bg) before:absolute before:top-full before:left-1/2 before:h-3.5 before:w-px before:-translate-x-1/2 before:bg-(--fl-edge-selected) active:cursor-grabbing group-data-selected/node:visible focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line)",
    handle: "size-(--fl-handle-size) cursor-crosshair rounded-(--fl-handle-radius) border-(length:--fl-handle-border) border-(--fl-handle-line) bg-(--fl-handle-bg) data-valid:bg-(--fl-valid) data-valid:ring-(length:--fl-focus-width) data-valid:ring-(--fl-valid)/40 data-invalid:bg-(--fl-invalid) focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line)",
    resizer:
        "invisible [[data-selected]>&]:visible [[data-resizing]>&]:visible",
    resizeHandle:
        "data-[position=top]:h-2 data-[position=bottom]:h-2 data-[position=left]:w-2 data-[position=right]:w-2 [&[data-position*='-']]:size-2.5 [&[data-position*='-']]:rounded-(--fl-handle-radius) [&[data-position*='-']]:border-(length:--fl-handle-border) [&[data-position*='-']]:border-(--fl-edge-selected) [&[data-position*='-']]:bg-(--fl-handle-bg) data-[position=top-left]:cursor-nwse-resize data-[position=bottom-right]:cursor-nwse-resize data-[position=top-right]:cursor-nesw-resize data-[position=bottom-left]:cursor-nesw-resize data-[position=top]:cursor-ns-resize data-[position=bottom]:cursor-ns-resize data-[position=left]:cursor-ew-resize data-[position=right]:cursor-ew-resize",
    toolbar:
        "palette-raised flex items-center gap-0.5 rounded-(--fl-control-radius) border border-palette-line bg-palette-base p-1 shadow-(--fl-node-shadow)",
    /** a shape's button in the toolbar: its outline as the icon, pressed when it is the node's */
    pick: "grid size-7 place-items-center rounded-(--fl-control-radius) text-palette-accent hover:bg-palette-soft aria-pressed:bg-palette-soft aria-pressed:text-(--fl-edge-selected) focus-visible:outline-2 focus-visible:outline-palette-ring [&_svg]:h-4 [&_svg]:w-5.5 [&_svg]:overflow-visible [&_path]:fill-none [&_path]:stroke-current [&_path]:stroke-[1.5]",
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
