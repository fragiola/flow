import { Component, DestroyRef, inject, signal } from "@angular/core";
import { injectFlow } from "@fragiola/flow-angular";
import { type features, PORTS, type Types } from "./index";
import { styles } from "./styles";

/** The legend, and how the last connection ended (the engine's events, inside the root). */
@Component({
    selector: "example-connection-validation-outcome",
    host: { class: "contents" },
    template: `
        <div [class]="styles.legend">
            @for (port of ports; track port) {
                <span [class]="styles.key(port)">{{ port }}</span>
            }
            <p role="status" data-testid="outcome" [class]="styles.outcome">{{ outcome() }}</p>
        </div>
    `,
})
export class Outcome {
    protected readonly styles = styles;
    protected readonly ports = PORTS;
    protected readonly outcome = signal("Drag from an output to an input.");

    constructor() {
        const { engine } = injectFlow<Types, typeof features>();
        const stop = engine.subscribe((event) => {
            if (event.type === "connect") this.outcome.set("Connected.");
            if (event.type === "connect-cancel") {
                this.outcome.set(
                    event.refused
                        ? "Refused: the rules do not allow that connection."
                        : "Dropped nowhere: nothing changed.",
                );
            }
        });
        inject(DestroyRef).onDestroy(stop);
    }
}
