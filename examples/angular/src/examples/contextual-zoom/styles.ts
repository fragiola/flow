// How this example looks: one class string (or function of an app value) per part, read from the
// theme's --fl-* tokens and the Fragiola palette roles, so the five example themes restyle it
// without touching the markup. A node's title is bigger at low detail (`data-detail`), where it is
// all the node shows.

export const styles = {
    root: "size-full min-h-0 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
    node: "group/node palette-raised flex w-44 select-none flex-col gap-1.5 rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) p-(--fl-node-padding) shadow-(--fl-node-shadow) transition-[border-color,box-shadow] duration-(--fl-motion) data-dragging:cursor-grabbing data-selected:border-(--fl-edge-selected) data-selected:ring-(length:--fl-focus-width) data-selected:ring-(--fl-edge-selected)/30 focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line)",
    title: "text-center font-(--fl-title-weight) group-data-[detail=low]/node:py-2 group-data-[detail=low]/node:text-xl",
    summary:
        "flex items-center justify-between gap-2 text-xs text-palette-accent",
    /** the health badge's palette: green when healthy, orange when degraded */
    health: (health: "healthy" | "degraded") =>
        health === "degraded" ? "palette-orange" : "palette-green",
    facts: "grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 border-t border-(--fl-node-line) pt-1.5 text-xs",
    term: "text-palette-accent",
    handle: "size-(--fl-handle-size) rounded-(--fl-handle-radius) border-(length:--fl-handle-border) border-(--fl-handle-line) bg-(--fl-handle-bg)",
    edgeGroup:
        "cursor-pointer outline-none focus-visible:[&>[data-flow-part=edge-path]]:stroke-(--fl-focus-line)",
    edge: "fill-none stroke-(--fl-edge-color) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)] data-selected:stroke-(--fl-edge-selected) data-selected:stroke-(length:--fl-edge-selected-width)",
    label: "palette-raised rounded-(--fl-control-radius) border border-(--fl-node-line) bg-palette-base px-1.5 py-0.5 text-xs text-palette-accent",
    controls:
        "palette-raised absolute bottom-3 start-3 flex flex-col overflow-hidden rounded-(--fl-control-radius) border border-palette-line bg-palette-base shadow-(--fl-node-shadow)",
    control:
        "grid size-8 place-items-center text-palette-accent not-last:border-b not-last:border-palette-line hover:bg-palette-soft focus-visible:outline-(length:--fl-focus-width) focus-visible:-outline-offset-2 focus-visible:outline-(--fl-focus-line) disabled:opacity-40 [&_svg]:size-4",
    readout:
        "palette-raised absolute top-3 end-3 rounded-(--fl-control-radius) border border-palette-line bg-palette-base px-2.5 py-1 text-xs text-palette-accent tabular-nums shadow-(--fl-node-shadow) select-none",
};
