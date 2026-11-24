import { Component, computed, input, type Signal } from "@angular/core";
import { LucideMousePointer2 } from "@lucide/angular";
import { styles } from "./styles";
import type { Presence } from "./sync";

/**
 * The other collaborators' pointers, in flow coordinates (inside `flowViewport`). It reads the
 * presence signal itself, so a remote pointer step checks this view only, not every node's.
 */
@Component({
    selector: "example-cursors",
    imports: [LucideMousePointer2],
    host: { class: "contents" },
    template: `
        @for (cursor of cursors(); track cursor.id) {
            <div
                data-testid="cursor"
                [attr.data-peer]="cursor.name"
                [class]="styles.cursor(cursor.name)"
                [style.transform]="cursor.transform"
            >
                <svg lucideMousePointer2 aria-hidden="true"></svg>
                <span [class]="styles.cursorName">{{ cursor.name }}</span>
            </div>
        }
    `,
})
export class Cursors {
    readonly presence = input.required<Signal<Presence>>();

    protected readonly styles = styles;
    protected readonly cursors = computed(() =>
        [...this.presence()()].flatMap(([id, { name, at }]) =>
            at
                ? [{ id, name, transform: `translate(${at.x}px, ${at.y}px)` }]
                : [],
        ),
    );
}
