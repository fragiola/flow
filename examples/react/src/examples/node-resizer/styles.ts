// How this example looks: one class string (or state function) per part, read from the theme's
// --fl-* tokens and the Fragiola palette roles, so the five example themes restyle it without
// touching the markup.

export const styles = {
    resizeHandle:
        "data-[position=top]:h-2 data-[position=bottom]:h-2 data-[position=left]:w-2 data-[position=right]:w-2 [&[data-position*='-']]:size-2.5 [&[data-position*='-']]:rounded-(--fl-handle-radius) [&[data-position*='-']]:border-(length:--fl-handle-border) [&[data-position*='-']]:border-(--fl-edge-selected) [&[data-position*='-']]:bg-(--fl-handle-bg) data-[position=top-left]:cursor-nwse-resize data-[position=bottom-right]:cursor-nwse-resize data-[position=top-right]:cursor-nesw-resize data-[position=bottom-left]:cursor-nesw-resize data-[position=top]:cursor-ns-resize data-[position=bottom]:cursor-ns-resize data-[position=left]:cursor-ew-resize data-[position=right]:cursor-ew-resize",
    node: "palette-raised flex size-full flex-col gap-1 select-none rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) p-(--fl-node-padding) shadow-(--fl-node-shadow) data-selected:border-(--fl-edge-selected) data-resizing:border-(--fl-edge-selected)",
    title: "text-sm font-(--fl-title-weight)",
    text: "text-xs text-palette-accent/85",
    limits: "mt-auto text-[0.6875rem] tabular-nums text-palette-accent/85",
    resizer:
        "invisible [[data-selected]>&]:visible [[data-resizing]>&]:visible",
    photo: "palette-blue min-h-0 flex-1 rounded-(--fl-control-radius) bg-linear-to-br from-palette-soft to-palette-line",
    root: "size-full min-h-0 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
};
