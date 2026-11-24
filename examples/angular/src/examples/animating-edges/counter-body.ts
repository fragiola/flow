import { Component, input } from "@angular/core";
import { styles } from "./styles";

/** The counter's body: how many values it has received, announced as they arrive. */
@Component({
    selector: "[exampleCounterBody]",
    template: `
        {{ label() }}
        <output aria-live="polite" aria-label="Values received" data-testid="received" [class]="styles.received">{{ received() }}</output>
    `,
})
export class CounterBody {
    readonly label = input.required<string>();
    readonly received = input.required<number>();
    protected readonly styles = styles;
}
