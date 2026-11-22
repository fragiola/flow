// How this example looks: one class string (or state function) per part, read from the theme's
// --fl-* tokens and the Fragiola palette roles, so the five example themes restyle it without
// touching the markup.

export const styles = {
    frame: "relative size-full min-h-0",
    root: "size-full min-h-0 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
    node: "palette-blue min-w-28 select-none rounded-(--fl-node-radius) border-(length:--fl-node-border) border-palette-line bg-palette-soft p-(--fl-node-padding) text-center font-(--fl-title-weight) text-palette-accent shadow-(--fl-node-shadow) data-selected:border-(--fl-edge-selected) focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-(--fl-focus-line)",
    handle: "size-(--fl-handle-size) rounded-(--fl-handle-radius) border-(length:--fl-handle-border) border-(--fl-handle-line) bg-(--fl-handle-bg)",
    edge: "fill-none stroke-(--fl-edge-color) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)]",
    menu: "palette-raised absolute z-10 flex min-w-40 flex-col rounded-(--fl-control-radius) border border-palette-line bg-palette-base p-1 text-sm shadow-(--fl-node-shadow)",
    item: "rounded-(--fl-control-radius) px-2.5 py-1.5 text-start text-palette-contrast hover:bg-palette-soft focus-visible:bg-palette-soft focus-visible:outline-2 focus-visible:outline-palette-ring",
    danger: "palette-danger rounded-(--fl-control-radius) px-2.5 py-1.5 text-start text-palette-accent hover:bg-palette-soft focus-visible:bg-palette-soft focus-visible:outline-2 focus-visible:outline-palette-ring",
};
