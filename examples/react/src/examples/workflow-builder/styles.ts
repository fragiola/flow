// How this example looks: one class string (or state function) per part, read from the theme's
// --fl-* tokens and the Fragiola palette roles, so the five example themes restyle it without
// touching the markup.

export const styles = {
    fields: "flex flex-col gap-3",
    inspector:
        "palette-raised flex min-h-0 flex-col gap-3 overflow-auto border-s border-palette-line bg-palette-base p-3",
    inspectorHeader: "flex items-center justify-between gap-2",
    inspectorTitle: "text-sm font-(--fl-title-weight)",
    iconButton:
        "palette-danger grid size-7 place-items-center rounded-(--fl-control-radius) text-palette-accent hover:bg-palette-soft focus-visible:outline-2 focus-visible:outline-palette-ring [&_svg]:size-4",
    muted: "text-xs text-palette-accent/85",
    issues: "border-t border-palette-line pt-3 text-xs",
    issue: "palette-orange flex items-start gap-1.5 text-palette-accent [&_svg]:mt-px [&_svg]:size-3.5 [&_svg]:shrink-0",
    ok: "palette-green flex items-center gap-1.5 text-palette-accent [&_svg]:size-4",
    issueList: "flex flex-col gap-1.5",
    issueMark:
        "palette-orange absolute -top-2 -end-2 grid size-5 place-items-center rounded-full bg-palette-base text-[0.6875rem] font-bold text-palette-contrast",
    step: "palette-raised flex w-55 select-none items-center gap-2.5 rounded-(--fl-node-radius) border-(length:--fl-node-border) border-(--fl-node-line) bg-(--fl-node-bg) p-(--fl-node-padding) text-start shadow-(--fl-node-shadow) transition-[border-color,box-shadow] duration-(--fl-motion) data-dragging:cursor-grabbing data-dragging:shadow-lg data-selected:border-(--fl-edge-selected) data-selected:ring-(length:--fl-focus-width) data-selected:ring-(--fl-edge-selected)/30 focus-visible:outline-(length:--fl-focus-width) focus-visible:outline-offset-2 focus-visible:outline-(--fl-focus-line)",
    /** a step's icon, in its type's palette */
    stepIcon: (type: "trigger" | "action" | "condition" | "delay") =>
        `${type === "trigger" ? "palette-green" : type === "action" ? "palette-blue" : type === "condition" ? "palette-orange" : "palette-purple"} grid size-9 shrink-0 place-items-center rounded-(--fl-control-radius) bg-palette-base text-palette-contrast [&_svg]:size-4.5`,
    stepText: "flex min-w-0 flex-col",
    stepType:
        "text-[0.625rem] font-semibold uppercase tracking-wide text-palette-accent/85",
    stepTitle: "truncate font-(--fl-title-weight)",
    stepSummary: "truncate font-mono text-[0.6875rem] text-palette-accent/85",
    port: "size-(--fl-handle-size) cursor-crosshair rounded-(--fl-handle-radius) border-(length:--fl-handle-border) border-(--fl-handle-line) bg-(--fl-handle-bg) data-valid:bg-(--fl-valid) data-valid:scale-125 data-invalid:bg-(--fl-invalid)",
    /** a condition's output: green for yes, danger for no */
    branchPort: (branch: "yes" | "no") =>
        `${branch === "yes" ? "palette-green" : "palette-danger"} size-(--fl-handle-size) cursor-crosshair rounded-(--fl-handle-radius) border-(length:--fl-handle-border) border-palette-base bg-palette-soft data-invalid:bg-(--fl-invalid)`,
    palette:
        "palette-raised flex min-h-0 flex-col gap-3 overflow-auto border-e border-palette-line bg-palette-base p-3",
    paletteGroup: "flex flex-col gap-1",
    paletteHeading:
        "text-[0.6875rem] font-semibold uppercase tracking-wide text-palette-accent/85",
    paletteItem:
        "flex cursor-grab items-center gap-2 rounded-(--fl-control-radius) px-1.5 py-1 text-start text-sm text-palette-contrast hover:bg-palette-soft active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-palette-ring",
    /** a palette entry's icon, in its group's palette */
    paletteIcon: (group: "Triggers" | "Actions" | "Logic") =>
        `${group === "Triggers" ? "palette-green" : group === "Actions" ? "palette-blue" : "palette-orange"} grid size-6 place-items-center rounded-(--fl-control-radius) bg-palette-soft text-palette-accent [&_svg]:size-3.5`,
    edge: "fill-none stroke-(--fl-edge-color) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)] data-selected:stroke-(--fl-edge-selected) data-selected:stroke-(length:--fl-edge-selected-width)",
    edgeGroup:
        "cursor-pointer outline-none focus-visible:[&>[data-flow-part=edge-path]:last-child]:stroke-(--fl-focus-line)",
    edgeHit: "fill-none stroke-transparent stroke-[16px]",
    /** a branch's label on its edge */
    branchLabel: (branch: "yes" | "no" | undefined) =>
        `${branch === "no" ? "palette-danger" : "palette-green"} rounded-full bg-palette-base px-2 py-0.5 text-[0.6875rem] font-semibold text-palette-contrast`,
    /** the header's status: green when ready, orange while issues are left */
    statusBadge: (ready: boolean) =>
        ready ? "palette-green" : "palette-orange",
    publish:
        "palette-blue h-8 rounded-(--fl-control-radius) bg-palette-base px-3 text-sm font-medium text-palette-contrast hover:bg-palette-base-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-palette-ring",
    app: "grid size-full min-h-0 font-(family-name:--fl-font) grid-cols-[11rem_minmax(0,1fr)_16rem] grid-rows-[auto_minmax(0,1fr)]",
    header: "palette-raised col-span-3 flex h-14 items-center gap-3 border-b border-palette-line bg-palette-base px-4",
    logo: "palette-blue grid size-8 place-items-center rounded-(--fl-control-radius) bg-palette-base text-palette-contrast [&_svg]:size-4",
    headerText: "me-auto flex flex-col",
    appTitle: "text-sm font-(--fl-title-weight)",
    breadcrumb: "text-xs text-palette-accent/85",
    root: "min-h-0 bg-(--fl-canvas-bg) font-(family-name:--fl-font) text-(length:--fl-font-size) text-palette-contrast",
    dots: "text-(--fl-grid-color) [display:var(--fl-grid-dots)]",
    lines: "text-(--fl-grid-color) [display:var(--fl-grid-lines)]",
    cross: "text-(--fl-grid-color) [display:var(--fl-grid-cross)]",
    connection:
        "fill-none stroke-(--fl-edge-selected) stroke-(length:--fl-edge-width) [stroke-dasharray:var(--fl-edge-dash)]",
    box: "border border-(--fl-selection-line) bg-(--fl-selection-bg)",
    control:
        "grid size-8 place-items-center text-palette-accent not-last:border-e not-last:border-palette-line hover:bg-palette-soft focus-visible:outline-(length:--fl-focus-width) focus-visible:-outline-offset-2 focus-visible:outline-(--fl-focus-line) disabled:opacity-40 [&_svg]:size-4",
    controls:
        "palette-raised absolute bottom-3 start-3 flex overflow-hidden rounded-(--fl-control-radius) border border-palette-line bg-palette-base shadow-(--fl-node-shadow)",
    minimap:
        "palette-raised absolute end-3 bottom-3 overflow-hidden rounded-(--fl-control-radius) border border-palette-line bg-palette-base shadow-(--fl-node-shadow)",
    minimapNode: "fill-palette-line data-selected:fill-(--fl-edge-selected)",
    minimapMask:
        "fill-(--fl-minimap-mask) stroke-(--fl-edge-selected) stroke-1",
};
