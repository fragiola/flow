// How this example looks: one class string (or state function) per part, read from the theme's
// --fl-* tokens and the Fragiola palette roles, so the five example themes restyle it without
// touching the markup.

export const styles = {
    node: "palette-raised relative min-h-16 w-32 select-none rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) p-(--fl-node-padding) shadow-(--fl-node-shadow) data-selected:border-(--fl-edge-selected)",
    title: "font-(--fl-title-weight)",
    /** a port: its palette says its type (blue for numbers, orange for text) */
    port: (type: "number" | "text") =>
        `${type === "number" ? "palette-blue" : "palette-orange"} size-(--fl-handle-size) cursor-crosshair rounded-(--fl-handle-radius) border-(length:--fl-handle-border) border-palette-accent bg-palette-base data-valid:outline-2 data-valid:outline-(--fl-valid) data-invalid:bg-(--fl-invalid) data-invalid:border-(--fl-invalid)`,
    legend: "palette-raised absolute top-3 start-3 flex max-w-72 flex-wrap items-center gap-2 rounded-(--fl-control-radius) border border-palette-line bg-palette-base px-2.5 py-1.5 text-xs shadow-(--fl-node-shadow)",
    /** a legend entry, in its type's palette */
    key: (type: "number" | "text") =>
        `${type === "number" ? "palette-blue" : "palette-orange"} rounded-full bg-palette-base px-2 py-0.5 text-palette-contrast`,
    outcome: "basis-full text-palette-accent",
    root: "size-full min-h-0 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
    edge: "fill-none stroke-(--fl-edge-color) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)] data-selected:stroke-(--fl-edge-selected) data-selected:stroke-(length:--fl-edge-selected-width)",
    connection:
        "fill-none stroke-(--fl-edge-selected) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)]",
};
