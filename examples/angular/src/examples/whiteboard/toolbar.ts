import { Component, input, output } from "@angular/core";
import {
    LucideDynamicIcon,
    LucideEraser,
    type LucideIcon,
    LucideLasso,
    LucideMousePointer2,
    LucidePencil,
    LucideSquare,
} from "@lucide/angular";
import type { Tool } from "./index";
import { styles } from "./styles";

// The tools, one pressed: a toolbar of toggle buttons, with the active tool's hint and the status.

const TOOLS = [
    { tool: "select", label: "Select", icon: LucideMousePointer2 },
    { tool: "rectangle", label: "Rectangle", icon: LucideSquare },
    { tool: "freehand", label: "Freehand", icon: LucidePencil },
    { tool: "eraser", label: "Eraser", icon: LucideEraser },
    { tool: "lasso", label: "Lasso", icon: LucideLasso },
] as const satisfies readonly {
    tool: Tool;
    label: string;
    icon: LucideIcon;
}[];

const HINTS: Record<Tool, string> = {
    select: "Drag the pane to pan, a node to move it.",
    rectangle: "Drag on the board to draw a rectangle.",
    freehand: "Draw with the pointer.",
    eraser: "Wipe over nodes and edges to erase them.",
    lasso: "Draw around nodes to select them.",
};

@Component({
    selector: "example-whiteboard-toolbar",
    imports: [LucideDynamicIcon],
    host: { class: "contents" },
    template: `
        <div [class]="styles.panel">
            <div role="toolbar" aria-label="Whiteboard tools" [class]="styles.tools">
                @for (each of tools; track each.tool) {
                    <button
                        type="button"
                        [attr.aria-label]="each.label"
                        [attr.aria-pressed]="tool() === each.tool"
                        [title]="each.label"
                        (click)="toolChange.emit(each.tool)"
                        [class]="styles.tool"
                    >
                        <svg [lucideIcon]="each.icon" aria-hidden="true"></svg>
                    </button>
                }
            </div>
            <p [class]="styles.hint">{{ hints[tool()] }}</p>
            <p role="status" [class]="styles.status">{{ status() }}</p>
        </div>
    `,
})
export class Toolbar {
    readonly tool = input.required<Tool>();
    readonly status = input.required<string>();
    /** a tool pressed: it becomes the active one */
    readonly toolChange = output<Tool>();
    protected readonly styles = styles;
    protected readonly tools = TOOLS;
    protected readonly hints = HINTS;
}
