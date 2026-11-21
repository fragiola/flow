import { Component, input } from "@angular/core";
import { FlowHandleDirective, injectFlow } from "@fragiola/flow-angular";
import type { features, Node, Types } from "./index";
import { styles } from "./styles";

// The colour node: a colour field that writes its node's data.
@Component({
    selector: "example-custom-nodes-colour",
    imports: [FlowHandleDirective],
    host: { class: "contents" },
    template: `
        <label [class]="styles.field">
            <span [class]="styles.caption">{{ node().data.label }}</span>
            <input
                type="color"
                [value]="node().data.colour"
                (input)="set($event)"
                [class]="styles.colourInput"
            />
        </label>
        <div flowHandle type="source" side="right" [class]="styles.handle"></div>
    `,
})
export class ColourNode {
    readonly node = input.required<Extract<Node, { type: "colour" }>>();
    protected readonly styles = styles;
    private readonly flow = injectFlow<Types, typeof features>();

    protected set(event: Event): void {
        this.flow.model().run("node.set-data", {
            nodeId: this.node().id,
            data: { colour: (event.target as HTMLInputElement).value },
        });
    }
}
