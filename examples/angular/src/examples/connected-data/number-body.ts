import { Component, input } from "@angular/core";
import { injectFlow } from "@fragiola/flow-angular";
import { LucideMinus, LucidePlus } from "@lucide/angular";
import type { features, Node, Types } from "./index";
import { styles } from "./styles";

// A number's value, with its steppers: `node.set-data` from the model.
@Component({
    selector: "example-connected-data-number",
    imports: [LucideMinus, LucidePlus],
    host: { class: "contents" },
    template: `
        <div [class]="styles.row">
            <span [class]="styles.title">{{ node().data.label }}</span>
            <button
                type="button"
                [attr.aria-label]="'Decrease ' + node().data.label"
                (click)="step(-1)"
                [class]="styles.step"
            >
                <svg lucideMinus aria-hidden="true"></svg>
            </button>
            <output [attr.data-testid]="'value-' + node().id" [class]="styles.value">{{ node().data.value }}</output>
            <button
                type="button"
                [attr.aria-label]="'Increase ' + node().data.label"
                (click)="step(1)"
                [class]="styles.step"
            >
                <svg lucidePlus aria-hidden="true"></svg>
            </button>
        </div>
    `,
})
export class NumberBody {
    readonly node = input.required<Extract<Node, { type: "number" }>>();
    protected readonly styles = styles;
    private readonly flow = injectFlow<Types, typeof features>();

    protected step(by: number): void {
        const node = this.node();
        this.flow.model().run("node.set-data", {
            nodeId: node.id,
            data: { value: node.data.value + by },
        });
    }
}
