import {
    afterRenderEffect,
    Component,
    type ElementRef,
    input,
    output,
    viewChild,
} from "@angular/core";
import { injectFlow } from "@fragiola/flow-angular";
import type { features, Node, Types } from "./index";
import { styles } from "./styles";

// The label, or its field while it is edited in place: Enter (or leaving the field) keeps it,
// Escape drops it.

@Component({
    selector: "example-shapes-label",
    host: { class: "contents" },
    template: `
        @if (editing()) {
            <input
                #field
                [attr.aria-label]="'Label of ' + node().data.label"
                [value]="node().data.label"
                (focus)="field.select()"
                (keydown)="key($event, field)"
                (blur)="blur(field)"
                [class]="styles.field"
            />
        } @else {
            <span [class]="styles.label">{{ node().data.label }}</span>
        }
    `,
})
export class ShapeLabel {
    readonly node = input.required<Node>();
    readonly editing = input(false);
    /** The edit closes (`false`): kept or dropped. */
    readonly editingChange = output<boolean>();
    protected readonly styles = styles;
    private readonly flow = injectFlow<Types, typeof features>();
    private readonly field = viewChild<ElementRef<HTMLInputElement>>("field");
    // Escape drops the edit: the blur that follows must not keep it
    private dropped = false;

    constructor() {
        // the field opens on the user's request, to type in: focused, each edit starting undropped
        afterRenderEffect(() => {
            const field = this.field()?.nativeElement;
            if (!field) return;
            this.dropped = false;
            field.focus();
        });
    }

    private keep(value: string): void {
        const label = value.trim();
        if (label !== "" && label !== this.node().data.label) {
            this.flow.model().run("node.set-data", {
                nodeId: this.node().id,
                data: { label },
            });
        }
        this.editingChange.emit(false);
    }

    protected key(event: KeyboardEvent, field: HTMLInputElement): void {
        if (event.key === "Enter") this.keep(field.value);
        if (event.key === "Escape") {
            this.dropped = true;
            this.editingChange.emit(false);
        }
    }

    protected blur(field: HTMLInputElement): void {
        if (this.dropped) this.dropped = false;
        else this.keep(field.value);
    }
}
