import { Component, output } from "@angular/core";
import { LucideDynamicIcon } from "@lucide/angular";
import { CATALOG, type CatalogEntry } from "./catalog";
import { styles } from "./styles";

// The step palette: each entry is dragged onto the canvas with the browser's drag and drop, or
// clicked to add the step in the middle of the view.

export const STEP_MIME = "application/x-workflow-step";

const GROUPS = ["Triggers", "Actions", "Logic"] as const;

@Component({
    selector: "example-workflow-palette",
    imports: [LucideDynamicIcon],
    host: { class: "contents" },
    template: `
        <nav aria-label="Steps" [class]="styles.palette">
            @for (group of groups; track group) {
                <section [attr.aria-labelledby]="'palette-' + group" [class]="styles.paletteGroup">
                    <h3 [id]="'palette-' + group" [class]="styles.paletteHeading">{{ group }}</h3>
                    @for (entry of entriesOf(group); track entry.id) {
                        <button
                            type="button"
                            draggable="true"
                            [class]="styles.paletteItem"
                            (dragstart)="onDragStart($event, entry)"
                            (click)="add.emit(entry)"
                        >
                            <span [class]="styles.paletteIcon(group)">
                                <svg [lucideIcon]="entry.icon" aria-hidden="true"></svg>
                            </span>
                            {{ entry.label }}
                        </button>
                    }
                </section>
            }
        </nav>
    `,
})
export class Palette {
    /** an entry clicked: add its step in the middle of the view */
    readonly add = output<CatalogEntry>();
    protected readonly styles = styles;
    protected readonly groups = GROUPS;

    protected entriesOf(group: CatalogEntry["group"]): CatalogEntry[] {
        return CATALOG.filter((entry) => entry.group === group);
    }

    protected onDragStart(event: DragEvent, entry: CatalogEntry): void {
        if (!event.dataTransfer) return;
        event.dataTransfer.setData(STEP_MIME, entry.id);
        event.dataTransfer.effectAllowed = "copy";
    }
}
