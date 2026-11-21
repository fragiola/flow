// How this example looks: one class string (or state function) per part, read from the theme's
// --fl-* tokens and the Fragiola palette roles, so the five example themes restyle it without
// touching the markup.

export const styles = {
    root: "size-full min-h-0 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
    edge: "fill-none stroke-(--fl-edge-color) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)] data-selected:stroke-(--fl-edge-selected) data-selected:stroke-(length:--fl-edge-selected-width)",
    /** a node, its palette by the kind of thing it stands for */
    node: (kind: "client" | "service" | "store") =>
        `${kind === "client" ? "palette-blue" : kind === "store" ? "palette-orange" : "palette-raised"} min-w-28 select-none rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-palette-base p-(--fl-node-padding) text-center font-(--fl-title-weight) text-palette-contrast shadow-(--fl-node-shadow)`,
    anchor: "size-px opacity-0",
    badge: "absolute top-3 end-3",
    controls:
        "palette-raised absolute bottom-3 start-3 flex flex-col overflow-hidden rounded-(--fl-control-radius) border border-palette-line bg-palette-base shadow-(--fl-node-shadow)",
    control:
        "grid size-8 place-items-center text-palette-accent not-last:border-b not-last:border-palette-line hover:bg-palette-soft focus-visible:outline-(length:--fl-focus-width) focus-visible:-outline-offset-2 focus-visible:outline-(--fl-focus-line) disabled:opacity-40 aria-pressed:text-(--fl-edge-selected) [&_svg]:size-4",
};
