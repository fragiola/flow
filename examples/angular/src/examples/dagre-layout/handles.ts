import { Component, computed, input } from "@angular/core";
import { FLOW } from "@fragiola/flow-angular";
import { type Direction, HANDLE_SIDES } from "./layout";
import { styles } from "./styles";

// A node's handles, on the sides the direction gives; remounted when it changes (a one-item `@for`
// tracked by the direction), as the engine reads a handle's side when it registers.
@Component({
    selector: "example-dagre-handles",
    imports: [FLOW],
    host: { class: "contents" },
    template: `
        @for (way of ways(); track way) {
            <div flowHandle type="target" [side]="sides[way].target" [class]="styles.handle"></div>
            <div flowHandle type="source" [side]="sides[way].source" [class]="styles.handle"></div>
        }
    `,
})
export class Handles {
    readonly direction = input.required<Direction>();
    protected readonly styles = styles;
    protected readonly sides = HANDLE_SIDES;
    protected readonly ways = computed(() => [this.direction()]);
}
