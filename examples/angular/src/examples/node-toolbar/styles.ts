// How this example looks: one class string (or state function) per part, read from the theme's
// --fl-* tokens and the Fragiola palette roles, so the five example themes restyle it without
// touching the markup.

export const styles = {
    toolbar:
        "palette-raised flex items-center gap-1 rounded-(--fl-control-radius) border border-palette-line bg-palette-base p-1 shadow-(--fl-node-shadow)",
    action: "grid size-7 place-items-center rounded-(--fl-control-radius) text-palette-accent hover:bg-palette-soft focus-visible:outline-2 focus-visible:outline-palette-ring [&_svg]:size-4",
    /** a tone's swatch; pressed when it is the note's */
    tone: (tone: "blue" | "green" | "orange" | "purple") =>
        `${{ blue: "palette-blue", green: "palette-green", orange: "palette-orange", purple: "palette-purple" }[tone]} size-5 rounded-full bg-palette-base aria-pressed:ring-2 aria-pressed:ring-palette-base aria-pressed:ring-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-palette-ring`,
    delete: "palette-danger grid size-7 place-items-center rounded-(--fl-control-radius) text-palette-accent hover:bg-palette-soft focus-visible:outline-2 focus-visible:outline-palette-ring [&_svg]:size-4",
    /** a sticky note, in its tone's palette */
    sticky: (tone: "blue" | "green" | "orange" | "purple") =>
        `${{ blue: "palette-blue", green: "palette-green", orange: "palette-orange", purple: "palette-purple" }[tone]} w-40 select-none rounded-(--fl-node-radius) bg-palette-soft p-(--fl-node-padding) text-sm font-(--fl-title-weight) text-palette-accent shadow-(--fl-node-shadow) data-selected:ring-(length:--fl-focus-width) data-selected:ring-palette-base`,
    root: "size-full min-h-0 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
};
