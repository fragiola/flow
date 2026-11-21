import { Component, input } from "@angular/core";
import { FlowHandleDirective, injectFlow } from "@fragiola/flow-angular";
import type { features, Node, Types } from "./index";
import { styles } from "./styles";

// The number node: a range that writes its node's data, and its value.
@Component({
    selector: "example-custom-nodes-number",
    imports: [FlowHandleDirective],
    host: { class: "contents" },
    template: `
        <label [class]="styles.field">
            <span [class]="styles.caption">{{ node().data.label }}</span>
            <input
                type="range"
                min="16"
                max="96"
                [value]="node().data.value"
                (input)="set($event)"
                [class]="styles.range"
            />
            <output [class]="styles.value">{{ node().data.value }}px</output>
        </label>
        <div flowHandle type="source" side="right" [class]="styles.handle"></div>
    `,
})
export class NumberNode {
    readonly node = input.required<Extract<Node, { type: "number" }>>();
    protected readonly styles = styles;
    private readonly flow = injectFlow<Types, typeof features>();

    protected set(event: Event): void {
        this.flow.model().run("node.set-data", {
            nodeId: this.node().id,
            data: { value: Number((event.target as HTMLInputElement).value) },
        });
    }
}
