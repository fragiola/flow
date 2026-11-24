// How this example looks: one class string per part, read from the theme's --fl-* tokens and the
// Fragiola palette roles, so the five example themes restyle it without touching the markup. Each
// collaborator has a palette (Alice orange, Bob blue): their cursor, their name tag and the dashed
// frame around the nodes they have selected, as the other side sees them.

/** A collaborator's palette, by name (anyone else: purple). */
const PEERS: Readonly<Record<string, string>> = {
    Alice: "palette-orange",
    Bob: "palette-blue",
};

const peer = (name: string) => PEERS[name] ?? "palette-purple";

export const styles = {
    frame: "relative grid size-full min-h-0 grid-cols-2 gap-px bg-palette-line font-(family-name:--fl-font) text-(length:--fl-font-size) max-sm:grid-cols-1 max-sm:grid-rows-2",
    side: "relative min-h-0 min-w-0",
    root: "size-full min-h-0 bg-(--fl-canvas-bg) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
    node: "palette-raised relative min-w-24 select-none rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) p-(--fl-node-padding) text-center font-(--fl-title-weight) shadow-(--fl-node-shadow) transition-[border-color,box-shadow] duration-(--fl-motion) data-dragging:cursor-grabbing data-selected:border-(--fl-edge-selected) data-selected:ring-(length:--fl-focus-width) data-selected:ring-(--fl-edge-selected)/30 focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line)",
    handle: "size-(--fl-handle-size) rounded-(--fl-handle-radius) border-(length:--fl-handle-border) border-(--fl-handle-line) bg-(--fl-handle-bg)",
    edge: "fill-none stroke-(--fl-edge-color) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)] data-selected:stroke-(--fl-edge-selected) data-selected:stroke-(length:--fl-edge-selected-width)",
    edgeGroup:
        "cursor-pointer outline-none focus-visible:[&>[data-flow-part=edge-path]]:stroke-(--fl-focus-line)",
    connection:
        "fill-none stroke-(--fl-edge-color) stroke-(length:--fl-edge-width) [stroke-dasharray:6_4]",
    /** the dashed frame around a node another collaborator has selected, with their name */
    mark: (name: string) =>
        `${peer(name)} pointer-events-none absolute -inset-1.5 rounded-(--fl-node-radius) border-2 border-dashed border-palette-base`,
    markName:
        "absolute -top-2.5 end-1 rounded-sm bg-palette-base px-1 text-[10px] leading-4 font-medium text-palette-contrast",
    /** another collaborator's pointer, placed in flow coordinates */
    cursor: (name: string) =>
        `${peer(name)} pointer-events-none absolute top-0 left-0 z-10 flex items-start [&_svg]:size-4 [&_svg]:fill-palette-base [&_svg]:stroke-palette-contrast`,
    cursorName:
        "mt-3 rounded-sm bg-palette-base px-1.5 text-xs leading-5 font-medium text-palette-contrast shadow-(--fl-node-shadow)",
    header: "palette-raised absolute top-3 start-3 flex items-center gap-2 rounded-(--fl-control-radius) border border-palette-line bg-palette-base p-1.5 ps-2.5 shadow-(--fl-node-shadow)",
    name: (name: string) =>
        `${peer(name)} flex items-center gap-1.5 text-sm font-semibold text-palette-accent before:size-2.5 before:rounded-full before:bg-palette-base`,
    button: "flex h-7 items-center gap-1 rounded-(--fl-control-radius) border border-palette-line px-2 text-xs text-palette-accent hover:bg-palette-soft focus-visible:outline-2 focus-visible:outline-palette-ring [&_svg]:size-3.5",
    hint: "pointer-events-none absolute bottom-3 start-3 end-3 text-xs text-palette-accent/85",
};
