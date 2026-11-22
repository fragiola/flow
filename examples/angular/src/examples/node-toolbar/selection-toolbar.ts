import { Component, computed } from "@angular/core";
import { FLOW, injectFlow, injectSelection } from "@fragiola/flow-angular";
import { LucideTrash2 } from "@lucide/angular";
import { type features, TONES, type Tone, type Types } from "./index";
import { styles } from "./styles";

/**
 * The selection's toolbar, below the selected notes while there are two or more (`nodeIds`):
 * recolour them all (one `batch`) or delete them (`selection.remove`). Rendered inside the root.
 */
@Component({
    selector: "example-selection-toolbar",
    imports: [FLOW, LucideTrash2],
    host: { class: "contents" },
    template: `
        @if (nodeIds().length >= 2) {
            <div
                flowNodeToolbar
                [nodeIds]="nodeIds()"
                side="bottom"
                role="toolbar"
                [attr.aria-label]="nodeIds().length + ' notes: actions'"
                [class]="styles.toolbar"
            >
                @for (tone of tones; track tone) {
                    <button
                        type="button"
                        [attr.aria-label]="'Make them ' + tone"
                        [class]="styles.tone(tone)"
                        (click)="recolour(tone)"
                    ></button>
                }
                <button type="button" aria-label="Delete them" [class]="styles.delete" (click)="remove()">
                    <svg lucideTrash2 aria-hidden="true"></svg>
                </button>
            </div>
        }
    `,
})
export class SelectionToolbar {
    protected readonly styles = styles;
    protected readonly tones = TONES;
    private readonly flow = injectFlow<Types, typeof features>();
    private readonly selected = injectSelection<Types>();
    protected readonly nodeIds = computed(() =>
        this.selected().nodes.map((node) => node.id),
    );

    protected recolour(tone: Tone): void {
        this.flow.model().run("batch", {
            commands: this.nodeIds().map((nodeId) => ({
                command: "node.set-data" as const,
                payload: { nodeId, data: { tone } },
            })),
        });
    }

    protected remove(): void {
        this.flow.model().run("selection.remove", {});
    }
}
