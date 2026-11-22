// How this example looks: one class string (or state function) per part, read from the theme's
// --fl-* tokens and the Fragiola palette roles, so the five example themes restyle it without
// touching the markup.

export const styles = {
    field: "flex flex-col items-start gap-1.5 text-start",
    caption: "text-xs text-palette-accent/85",
    colourInput:
        "h-8 w-24 cursor-pointer rounded-(--fl-control-radius) border border-palette-line bg-transparent",
    handle: "size-(--fl-handle-size) cursor-crosshair rounded-(--fl-handle-radius) border-(length:--fl-handle-border) border-(--fl-handle-line) bg-(--fl-handle-bg) data-valid:bg-(--fl-valid) data-invalid:bg-(--fl-invalid)",
    range: "w-32 accent-(--fl-edge-selected)",
    value: "text-xs tabular-nums text-palette-accent",
    dragHandle:
        "flex cursor-grab items-center justify-between gap-3 rounded-(--fl-control-radius) border border-palette-line bg-palette-soft px-2 py-1 active:cursor-grabbing",
    grip: "h-2 w-4 bg-[radial-gradient(currentColor_1px,transparent_1.5px)] bg-size-[4px_4px] text-palette-accent/70",
    stage: "mt-2 grid size-28 place-items-center rounded-(--fl-control-radius) border border-dashed border-palette-line bg-palette-soft",
    swatch: "rounded-(--fl-node-radius) shadow-(--fl-node-shadow)",
    empty: "px-2 text-xs font-normal text-palette-accent/85",
    node: "palette-raised min-w-28 select-none rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) p-(--fl-node-padding) text-center font-(--fl-title-weight) shadow-(--fl-node-shadow) transition-[border-color,box-shadow] duration-(--fl-motion) data-dragging:cursor-grabbing data-selected:border-(--fl-edge-selected) data-selected:ring-(length:--fl-focus-width) data-selected:ring-(--fl-edge-selected)/30 focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line)",
    root: "size-full min-h-0 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
    edge: "fill-none stroke-(--fl-edge-color) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)] data-selected:stroke-(--fl-edge-selected) data-selected:stroke-(length:--fl-edge-selected-width)",
    connection:
        "fill-none stroke-(--fl-edge-selected) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)]",
};
