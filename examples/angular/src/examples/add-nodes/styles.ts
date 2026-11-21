// How this example looks: one class string (or state function) per part, read from the theme's
// --fl-* tokens and the Fragiola palette roles, so the five example themes restyle it without
// touching the markup.

export const styles = {
    /** a node, its shape by its type: a pill to start, a box for a task, a slanted box to decide */
    shape: (shape: "circle" | "square" | "diamond") =>
        `${shape === "circle" ? "palette-green rounded-full" : shape === "diamond" ? "palette-orange -skew-x-12 rounded-(--fl-node-radius)" : "palette-blue rounded-(--fl-node-radius)"} min-w-25 select-none border-(length:--fl-node-border) border-palette-line bg-palette-soft px-4 py-2 text-center font-(--fl-title-weight) text-palette-accent shadow-(--fl-node-shadow) data-selected:border-(--fl-edge-selected)`,
    handle: "size-(--fl-handle-size) cursor-crosshair rounded-(--fl-handle-radius) border-(length:--fl-handle-border) border-(--fl-handle-line) bg-(--fl-handle-bg) data-valid:bg-(--fl-valid) data-invalid:bg-(--fl-invalid)",
    layout: "flex size-full min-h-0",
    palette:
        "palette-raised flex w-40 shrink-0 flex-col gap-1.5 border-e border-palette-line bg-palette-base p-3",
    paletteTitle: "mb-1 text-xs text-palette-accent/85",
    item: "flex cursor-grab items-center gap-2 rounded-(--fl-control-radius) border border-palette-line px-2.5 py-1.5 text-sm text-palette-contrast hover:bg-palette-soft active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-palette-ring [&_svg]:size-4 [&_svg]:text-palette-accent",
    root: "min-w-0 flex-1 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
    edge: "fill-none stroke-(--fl-edge-color) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)] data-selected:stroke-(--fl-edge-selected) data-selected:stroke-(length:--fl-edge-selected-width)",
    connection:
        "fill-none stroke-(--fl-edge-selected) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)]",
};
